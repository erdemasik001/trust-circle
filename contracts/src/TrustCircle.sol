// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title Trust Circle
/// @notice Uncollateralized USDC micro-loans between verified humans, backed by friends who vouch.
/// @dev Vouchers escrow USDC for a borrower; the escrow sets the borrower's limit and funds the loan.
///      All payouts to vouchers (interest, leftover stake, compensation) are pull-based via `claim()`, so a
///      blocklisted voucher can never block a repayment or a liquidation.
contract TrustCircle is Ownable2Step, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    // ─── Types ───────────────────────────────────────────────────────────

    enum Tier {
        Newcomer,
        Rising,
        Trusted,
        Leader
    }

    enum LoanStatus {
        None,
        Active,
        Repaid,
        Defaulted
    }

    struct Vouch {
        uint128 amount; // USDC escrowed by the voucher for this borrower, including the locked part
        uint128 locked; // part of `amount` currently lent out to the borrower
        uint64 activatesAt; // the stake counts towards the limit from this time on
    }

    struct Loan {
        uint128 principal;
        uint128 interest;
        uint64 startedAt;
        uint64 dueAt;
        LoanStatus status;
    }

    struct TierParams {
        uint256 maxBorrow; // USDC, 6 decimals
        uint256 minVouchers;
        uint256 interestBps;
    }

    // ─── Constants ───────────────────────────────────────────────────────

    bytes32 public constant ATTEST_TYPEHASH =
        keccak256("Attestation(address wallet,uint256 nullifierHash,uint256 deadline)");

    uint256 internal constant BPS = 10_000;

    uint256 public constant MIN_VOUCH = 1e6; // 1 USDC
    uint256 public constant MAX_VOUCHERS_PER_BORROWER = 10;
    /// @notice A single voucher can back at most this share of the borrower's tier max.
    uint256 public constant MAX_VOUCHER_SHARE_BPS = 4_000;

    uint256 public constant LOAN_DURATION = 30 days;
    uint256 public constant GRACE_PERIOD = 7 days;

    uint256 public constant INSURANCE_FEE_BPS = 100; // 1% of principal, taken at borrow
    uint256 public constant VOUCHER_INTEREST_BPS = 8_000; // 80% of interest; the rest is protocol fee

    uint256 public constant INITIAL_REPUTATION = 100;
    uint256 public constant REPAY_REPUTATION_GAIN = 10;
    uint256 public constant RISING_REPUTATION = 150;
    uint256 public constant TRUSTED_REPUTATION = 300;
    uint256 public constant LEADER_REPUTATION = 500;

    /// @notice Borrowing halts when defaulted principal exceeds this share of all lent principal.
    uint256 public constant CIRCUIT_BREAKER_BPS = 1_000; // 10%
    /// @notice The circuit breaker only arms once this much principal has been lent.
    uint256 public constant CIRCUIT_BREAKER_MIN_VOLUME = 1_000e6;

    // ─── Immutables ──────────────────────────────────────────────────────

    IERC20 public immutable usdc;
    /// @notice Time between a vouch and the moment it counts towards the borrower's limit.
    uint256 public immutable activationDelay;

    // ─── Storage ─────────────────────────────────────────────────────────

    address public attester;

    mapping(uint256 nullifierHash => bool) public usedNullifier;
    mapping(address account => bool) public isHuman;
    mapping(address account => uint256) public reputation;
    mapping(address account => bool) public hasDefaulted;

    mapping(address voucher => mapping(address borrower => Vouch)) internal _vouches;
    mapping(address borrower => address[]) internal _vouchers;

    mapping(address borrower => Loan) public loans;

    mapping(address account => uint256) public claimable;

    uint256 public totalStaked; // sum of all Vouch.amount
    uint256 public totalLocked; // sum of all Vouch.locked
    uint256 public totalClaimable;
    uint256 public insurancePool;
    uint256 public protocolFees;

    uint256 public totalLent; // lifetime principal lent
    uint256 public totalDefaulted; // lifetime principal defaulted

    // ─── Events ──────────────────────────────────────────────────────────

    event AttesterUpdated(address indexed previous, address indexed current);
    event Registered(address indexed account, uint256 indexed nullifierHash);
    event Vouched(address indexed voucher, address indexed borrower, uint256 amount, uint256 activatesAt);
    event Withdrawn(address indexed voucher, address indexed borrower, uint256 amount);
    event Borrowed(address indexed borrower, uint256 principal, uint256 interest, uint256 dueAt);
    event Repaid(address indexed borrower, uint256 principal, uint256 interest, bool onTime);
    event Liquidated(address indexed borrower, address indexed liquidator, uint256 principal);
    event Compensated(address indexed voucher, uint256 amount);
    event Claimed(address indexed account, uint256 amount);
    event ProtocolFeesWithdrawn(address indexed to, uint256 amount);

    // ─── Errors ──────────────────────────────────────────────────────────

    error ZeroAddress();
    error AttestationExpired();
    error BadAttestation();
    error NullifierUsed();
    error AlreadyRegistered();
    error NotHuman(address account);
    error SelfVouch();
    error VouchTooSmall();
    error TooManyVouchers();
    error VouchLocked();
    error InsufficientStake();
    error ActiveLoan();
    error NoActiveLoan();
    error BorrowerDefaulted();
    error ZeroAmount();
    error ExceedsLimit(uint256 requested, uint256 limit);
    error CircuitBreakerTripped();
    error NotLiquidatable();
    error ExceedsInsurancePool();
    error NothingToClaim();

    // ─── Constructor ─────────────────────────────────────────────────────

    constructor(IERC20 usdc_, address attester_, uint256 activationDelay_, address owner_)
        Ownable(owner_)
        EIP712("TrustCircle", "1")
    {
        if (address(usdc_) == address(0) || attester_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
        attester = attester_;
        activationDelay = activationDelay_;
        emit AttesterUpdated(address(0), attester_);
    }

    // ─── Identity ────────────────────────────────────────────────────────

    /// @notice Registers `msg.sender` as a unique human using an attestation signed by the attester
    ///         after it verified a World ID proof whose signal was this wallet.
    function register(uint256 nullifierHash, uint256 deadline, bytes calldata signature) external {
        if (block.timestamp > deadline) revert AttestationExpired();
        if (isHuman[msg.sender]) revert AlreadyRegistered();
        if (usedNullifier[nullifierHash]) revert NullifierUsed();

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(ATTEST_TYPEHASH, msg.sender, nullifierHash, deadline)));
        if (ECDSA.recover(digest, signature) != attester) revert BadAttestation();

        usedNullifier[nullifierHash] = true;
        isHuman[msg.sender] = true;
        reputation[msg.sender] = INITIAL_REPUTATION;
        emit Registered(msg.sender, nullifierHash);
    }

    function setAttester(address attester_) external onlyOwner {
        if (attester_ == address(0)) revert ZeroAddress();
        emit AttesterUpdated(attester, attester_);
        attester = attester_;
    }

    // ─── Vouching ────────────────────────────────────────────────────────

    /// @notice Escrows `amount` USDC as a stake for `borrower`. A top-up restarts the activation delay
    ///         for the whole vouch, and is only allowed while none of it is lent out.
    function vouchForUser(address borrower, uint256 amount) external nonReentrant {
        if (!isHuman[msg.sender]) revert NotHuman(msg.sender);
        if (!isHuman[borrower]) revert NotHuman(borrower);
        if (borrower == msg.sender) revert SelfVouch();
        if (hasDefaulted[borrower]) revert BorrowerDefaulted();
        if (amount < MIN_VOUCH) revert VouchTooSmall();

        Vouch storage v = _vouches[msg.sender][borrower];
        if (v.locked != 0) revert VouchLocked();
        if (v.amount == 0) {
            if (_vouchers[borrower].length >= MAX_VOUCHERS_PER_BORROWER) revert TooManyVouchers();
            _vouchers[borrower].push(msg.sender);
        }

        v.amount += amount.toUint128();
        v.activatesAt = (block.timestamp + activationDelay).toUint64();
        totalStaked += amount;

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Vouched(msg.sender, borrower, v.amount, v.activatesAt);
    }

    /// @notice Withdraws up to the unlocked part of the caller's stake for `borrower`.
    function withdraw(address borrower, uint256 amount) public nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Vouch storage v = _vouches[msg.sender][borrower];
        if (amount > v.amount - v.locked) revert InsufficientStake();

        v.amount -= amount.toUint128();
        totalStaked -= amount;
        if (v.amount == 0) _removeVoucher(borrower, msg.sender);

        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, borrower, amount);
    }

    /// @notice Withdraws the caller's whole stake for `borrower`. Reverts while any of it is lent out.
    function revokeVouch(address borrower) external {
        Vouch storage v = _vouches[msg.sender][borrower];
        if (v.locked != 0) revert VouchLocked();
        withdraw(borrower, v.amount);
    }

    // ─── Loans ───────────────────────────────────────────────────────────

    /// @notice Borrows `amount` USDC from the caller's vouchers' escrow, locked pro rata to what each backs.
    ///         The borrower receives `amount` minus the 1% insurance fee and owes `amount` plus tier interest.
    function borrow(uint256 amount) external nonReentrant {
        if (!isHuman[msg.sender]) revert NotHuman(msg.sender);
        if (hasDefaulted[msg.sender]) revert BorrowerDefaulted();
        if (loans[msg.sender].status == LoanStatus.Active) revert ActiveLoan();
        if (amount == 0) revert ZeroAmount();
        if (isCircuitBreakerTripped()) revert CircuitBreakerTripped();

        TierParams memory tp = tierParams(tierOf(msg.sender));
        address[] storage vs = _vouchers[msg.sender];
        uint256 n = vs.length;
        uint256[] memory contrib = new uint256[](n);
        uint256 total = _contributions(msg.sender, tp, contrib);
        uint256 limit = _limit(total, contrib, tp);
        if (amount > limit) revert ExceedsLimit(amount, limit);

        // Lock pro rata to each voucher's contribution, then hand out rounding dust where there is room.
        uint256[] memory share = new uint256[](n);
        uint256 assigned;
        for (uint256 i; i < n; ++i) {
            share[i] = amount * contrib[i] / total;
            assigned += share[i];
        }
        for (uint256 i; assigned < amount; ++i) {
            if (share[i] < contrib[i]) {
                ++share[i];
                ++assigned;
            }
        }
        for (uint256 i; i < n; ++i) {
            if (share[i] != 0) _vouches[vs[i]][msg.sender].locked = share[i].toUint128();
        }

        uint256 interest = amount * tp.interestBps / BPS;
        uint256 fee = amount * INSURANCE_FEE_BPS / BPS;
        uint256 dueAt = block.timestamp + LOAN_DURATION;
        loans[msg.sender] = Loan({
            principal: amount.toUint128(),
            interest: interest.toUint128(),
            startedAt: block.timestamp.toUint64(),
            dueAt: dueAt.toUint64(),
            status: LoanStatus.Active
        });
        totalLocked += amount;
        totalLent += amount;
        insurancePool += fee;

        usdc.safeTransfer(msg.sender, amount - fee);
        emit Borrowed(msg.sender, amount, interest, dueAt);
    }

    /// @notice Repays the caller's active loan in full: principal plus interest.
    ///         Principal is unlocked back into the vouchers' escrow; 80% of interest becomes claimable by them.
    function repay() external nonReentrant {
        Loan storage loan = loans[msg.sender];
        if (loan.status != LoanStatus.Active) revert NoActiveLoan();

        uint256 principal = loan.principal;
        uint256 interest = loan.interest;
        bool onTime = block.timestamp <= loan.dueAt;
        loan.status = LoanStatus.Repaid;

        uint256 distributed;
        address[] storage vs = _vouchers[msg.sender];
        for (uint256 i; i < vs.length; ++i) {
            Vouch storage v = _vouches[vs[i]][msg.sender];
            uint256 locked = v.locked;
            if (locked == 0) continue;
            v.locked = 0;
            uint256 cut = interest * VOUCHER_INTEREST_BPS * locked / (BPS * principal);
            if (cut != 0) {
                claimable[vs[i]] += cut;
                distributed += cut;
            }
        }
        totalLocked -= principal;
        totalClaimable += distributed;
        protocolFees += interest - distributed;

        if (onTime) reputation[msg.sender] += REPAY_REPUTATION_GAIN;

        usdc.safeTransferFrom(msg.sender, address(this), principal + interest);
        emit Repaid(msg.sender, principal, interest, onTime);
    }

    /// @notice Closes a loan that is past due plus the grace period. Anyone can call it; vouchers have the
    ///         incentive, since their unlent stake for this borrower stays frozen until then. Vouchers lose the
    ///         locked stake and the rest of their stake for this borrower becomes claimable.
    /// @dev No liquidation reward and no automatic insurance payout: with Device-level World ID one person can
    ///      hold several identities, and any automatic payout from the shared pool would let them drain it by
    ///      defaulting to themselves. The pool only grows; the owner can compensate vouchers case by case.
    function liquidate(address borrower) external nonReentrant {
        Loan storage loan = loans[borrower];
        if (loan.status != LoanStatus.Active || block.timestamp <= loan.dueAt + GRACE_PERIOD) {
            revert NotLiquidatable();
        }

        uint256 principal = loan.principal;
        loan.status = LoanStatus.Defaulted;
        hasDefaulted[borrower] = true;
        reputation[borrower] = 0;
        totalDefaulted += principal;

        uint256 stakeReleased;
        address[] storage vs = _vouchers[borrower];
        for (uint256 i; i < vs.length; ++i) {
            address voucher = vs[i];
            Vouch memory v = _vouches[voucher][borrower];
            uint256 unlent = v.amount - v.locked;
            if (unlent != 0) {
                claimable[voucher] += unlent;
                stakeReleased += unlent;
            }
            delete _vouches[voucher][borrower];
        }
        delete _vouchers[borrower];

        totalStaked -= principal + stakeReleased;
        totalLocked -= principal;
        totalClaimable += stakeReleased;

        emit Liquidated(borrower, msg.sender, principal);
    }

    // ─── Payouts ─────────────────────────────────────────────────────────

    function claim() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();
        claimable[msg.sender] = 0;
        totalClaimable -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /// @notice Pays a voucher from the insurance pool after a default, reviewed by the owner.
    function compensate(address voucher, uint256 amount) external onlyOwner {
        if (amount > insurancePool) revert ExceedsInsurancePool();
        insurancePool -= amount;
        claimable[voucher] += amount;
        totalClaimable += amount;
        emit Compensated(voucher, amount);
    }

    function withdrawProtocolFees(address to) external nonReentrant onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = protocolFees;
        protocolFees = 0;
        usdc.safeTransfer(to, amount);
        emit ProtocolFeesWithdrawn(to, amount);
    }

    // ─── Views ───────────────────────────────────────────────────────────

    function tierOf(address account) public view returns (Tier) {
        uint256 rep = reputation[account];
        if (rep >= LEADER_REPUTATION) return Tier.Leader;
        if (rep >= TRUSTED_REPUTATION) return Tier.Trusted;
        if (rep >= RISING_REPUTATION) return Tier.Rising;
        return Tier.Newcomer;
    }

    function tierParams(Tier tier) public pure returns (TierParams memory) {
        if (tier == Tier.Leader) return TierParams({maxBorrow: 5_000e6, minVouchers: 5, interestBps: 800});
        if (tier == Tier.Trusted) return TierParams({maxBorrow: 2_000e6, minVouchers: 3, interestBps: 1_000});
        if (tier == Tier.Rising) return TierParams({maxBorrow: 500e6, minVouchers: 2, interestBps: 1_200});
        return TierParams({maxBorrow: 100e6, minVouchers: 1, interestBps: 1_500});
    }

    /// @notice What `borrower` could borrow right now: min(tier max, sum of capped active stakes),
    ///         or zero without enough active vouchers, with an open loan, or after a default.
    function availableLimit(address borrower) external view returns (uint256) {
        if (!isHuman[borrower] || hasDefaulted[borrower] || loans[borrower].status == LoanStatus.Active) return 0;
        TierParams memory tp = tierParams(tierOf(borrower));
        uint256[] memory contrib = new uint256[](_vouchers[borrower].length);
        uint256 total = _contributions(borrower, tp, contrib);
        return _limit(total, contrib, tp);
    }

    function getVouch(address voucher, address borrower) external view returns (Vouch memory) {
        return _vouches[voucher][borrower];
    }

    function getVouchers(address borrower) external view returns (address[] memory) {
        return _vouchers[borrower];
    }

    function isCircuitBreakerTripped() public view returns (bool) {
        return totalLent >= CIRCUIT_BREAKER_MIN_VOLUME && totalDefaulted * BPS > totalLent * CIRCUIT_BREAKER_BPS;
    }

    // ─── Internal ────────────────────────────────────────────────────────

    /// @dev Fills `contrib` with each voucher's active, unlocked stake capped at 40% of the tier max.
    function _contributions(address borrower, TierParams memory tp, uint256[] memory contrib)
        internal
        view
        returns (uint256 total)
    {
        uint256 cap = tp.maxBorrow * MAX_VOUCHER_SHARE_BPS / BPS;
        address[] storage vs = _vouchers[borrower];
        for (uint256 i; i < vs.length; ++i) {
            Vouch storage v = _vouches[vs[i]][borrower];
            if (block.timestamp < v.activatesAt) continue;
            uint256 c = _min(v.amount - v.locked, cap);
            contrib[i] = c;
            total += c;
        }
    }

    function _limit(uint256 total, uint256[] memory contrib, TierParams memory tp) internal pure returns (uint256) {
        uint256 active;
        for (uint256 i; i < contrib.length; ++i) {
            if (contrib[i] != 0) ++active;
        }
        if (active < tp.minVouchers) return 0;
        return _min(total, tp.maxBorrow);
    }

    function _removeVoucher(address borrower, address voucher) internal {
        address[] storage vs = _vouchers[borrower];
        uint256 last = vs.length - 1;
        for (uint256 i; i <= last; ++i) {
            if (vs[i] == voucher) {
                vs[i] = vs[last];
                vs.pop();
                return;
            }
        }
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
