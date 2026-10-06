// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {TrustCircle} from "../src/TrustCircle.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract TrustCircleTestBase is Test {
    uint256 internal constant DELAY = 300; // testnet activation delay

    MockUSDC internal usdc;
    TrustCircle internal tc;

    address internal owner = makeAddr("owner");
    uint256 internal attesterKey;
    address internal attester;

    address internal borrower = makeAddr("borrower");
    address internal voucher = makeAddr("voucher");

    uint256 internal nextNullifier = 1;

    function setUp() public virtual {
        (attester, attesterKey) = makeAddrAndKey("attester");
        usdc = new MockUSDC();
        tc = new TrustCircle(usdc, attester, DELAY, owner);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────

    function _sign(uint256 key, address wallet, uint256 nullifier, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(abi.encode(tc.ATTEST_TYPEHASH(), wallet, nullifier, deadline));
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("TrustCircle"),
                keccak256("1"),
                block.chainid,
                address(tc)
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(key, keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash)));
        return abi.encodePacked(r, s, v);
    }

    function _register(address who) internal {
        uint256 nullifier = nextNullifier++;
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(attesterKey, who, nullifier, deadline);
        vm.prank(who);
        tc.register(nullifier, deadline, sig);
    }

    function _vouch(address from, address to, uint256 amount) internal {
        usdc.mint(from, amount);
        vm.startPrank(from);
        usdc.approve(address(tc), amount);
        tc.vouchForUser(to, amount);
        vm.stopPrank();
    }

    function _repay(address who) internal {
        (uint128 principal, uint128 interest,,,) = tc.loans(who);
        uint256 owed = uint256(principal) + interest;
        uint256 bal = usdc.balanceOf(who);
        if (bal < owed) usdc.mint(who, owed - bal);
        vm.startPrank(who);
        usdc.approve(address(tc), owed);
        tc.repay();
        vm.stopPrank();
    }

    function _status(address who) internal view returns (TrustCircle.LoanStatus status) {
        (,,,, status) = tc.loans(who);
    }

    /// @dev Contract balance must cover every liability it tracks.
    function _assertSolvent() internal view {
        uint256 liabilities =
            tc.totalStaked() - tc.totalLocked() + tc.totalClaimable() + tc.insurancePool() + tc.protocolFees();
        assertGe(usdc.balanceOf(address(tc)), liabilities, "insolvent");
    }
}

contract RegisterTest is TrustCircleTestBase {
    function test_register_validAttestation() public {
        _register(borrower);
        assertTrue(tc.isHuman(borrower));
        assertEq(tc.reputation(borrower), 100);
        assertTrue(tc.usedNullifier(1));
    }

    function test_register_sameNullifierTwiceReverts() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory first = _sign(attesterKey, borrower, 7, deadline);
        vm.prank(borrower);
        tc.register(7, deadline, first);

        bytes memory sig = _sign(attesterKey, voucher, 7, deadline);
        vm.prank(voucher);
        vm.expectRevert(TrustCircle.NullifierUsed.selector);
        tc.register(7, deadline, sig);
    }

    function test_register_wrongSignerReverts() public {
        (, uint256 otherKey) = makeAddrAndKey("not-attester");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(otherKey, borrower, 1, deadline);
        vm.prank(borrower);
        vm.expectRevert(TrustCircle.BadAttestation.selector);
        tc.register(1, deadline, sig);
    }

    function test_register_expiredDeadlineReverts() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(attesterKey, borrower, 1, deadline);
        vm.warp(deadline + 1);
        vm.prank(borrower);
        vm.expectRevert(TrustCircle.AttestationExpired.selector);
        tc.register(1, deadline, sig);
    }

    function test_register_signatureForAnotherWalletReverts() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(attesterKey, borrower, 1, deadline);
        vm.prank(voucher); // front-runner replays borrower's attestation
        vm.expectRevert(TrustCircle.BadAttestation.selector);
        tc.register(1, deadline, sig);
    }

    function test_register_twiceReverts() public {
        _register(borrower);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(attesterKey, borrower, 99, deadline);
        vm.prank(borrower);
        vm.expectRevert(TrustCircle.AlreadyRegistered.selector);
        tc.register(99, deadline, sig);
    }

    function test_setAttester_rotatesKey() public {
        (address newAttester, uint256 newKey) = makeAddrAndKey("new-attester");
        vm.prank(owner);
        tc.setAttester(newAttester);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory oldSig = _sign(attesterKey, borrower, 1, deadline);
        vm.prank(borrower);
        vm.expectRevert(TrustCircle.BadAttestation.selector);
        tc.register(1, deadline, oldSig);

        bytes memory newSig = _sign(newKey, borrower, 1, deadline);
        vm.prank(borrower);
        tc.register(1, deadline, newSig);
        assertTrue(tc.isHuman(borrower));
    }

    function test_setAttester_onlyOwner() public {
        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, borrower));
        tc.setAttester(borrower);
    }

    function test_register_malformedSignatureReverts() public {
        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureLength.selector, 3));
        tc.register(1, block.timestamp + 1, hex"010203");
    }
}

contract VouchTest is TrustCircleTestBase {
    function setUp() public override {
        super.setUp();
        _register(borrower);
        _register(voucher);
    }

    function test_vouch_pullsUSDCIntoEscrow() public {
        _vouch(voucher, borrower, 20e6);
        assertEq(usdc.balanceOf(address(tc)), 20e6);
        assertEq(usdc.balanceOf(voucher), 0);
        TrustCircle.Vouch memory v = tc.getVouch(voucher, borrower);
        assertEq(v.amount, 20e6);
        assertEq(v.locked, 0);
        assertEq(v.activatesAt, block.timestamp + DELAY);
        assertEq(tc.totalStaked(), 20e6);
    }

    function test_vouch_requiresBothHuman() public {
        address stranger = makeAddr("stranger");
        usdc.mint(stranger, 5e6);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(TrustCircle.NotHuman.selector, stranger));
        tc.vouchForUser(borrower, 5e6);

        vm.prank(voucher);
        vm.expectRevert(abi.encodeWithSelector(TrustCircle.NotHuman.selector, stranger));
        tc.vouchForUser(stranger, 5e6);
    }

    function test_vouch_selfReverts() public {
        vm.prank(voucher);
        vm.expectRevert(TrustCircle.SelfVouch.selector);
        tc.vouchForUser(voucher, 5e6);
    }

    function test_vouch_belowMinimumReverts() public {
        vm.prank(voucher);
        vm.expectRevert(TrustCircle.VouchTooSmall.selector);
        tc.vouchForUser(borrower, 1e6 - 1);
    }

    function test_vouch_notActiveBeforeDelay() public {
        _vouch(voucher, borrower, 20e6);
        assertEq(tc.availableLimit(borrower), 0);
        vm.warp(block.timestamp + DELAY - 1);
        assertEq(tc.availableLimit(borrower), 0);
        vm.warp(block.timestamp + 1);
        assertEq(tc.availableLimit(borrower), 20e6);
    }

    function test_vouch_topUpRestartsActivation() public {
        _vouch(voucher, borrower, 10e6);
        vm.warp(block.timestamp + DELAY);
        assertEq(tc.availableLimit(borrower), 10e6);
        _vouch(voucher, borrower, 10e6);
        assertEq(tc.availableLimit(borrower), 0);
        vm.warp(block.timestamp + DELAY);
        assertEq(tc.availableLimit(borrower), 20e6);
        assertEq(tc.getVouchers(borrower).length, 1);
    }

    function test_vouch_singleVoucherCappedAt40Percent() public {
        _vouch(voucher, borrower, 100e6);
        vm.warp(block.timestamp + DELAY);
        assertEq(tc.availableLimit(borrower), 40e6); // Newcomer max 100 * 40%
    }

    function test_vouch_eleventhVoucherReverts() public {
        for (uint256 i; i < 10; ++i) {
            address v = makeAddr(string.concat("v", vm.toString(i)));
            _register(v);
            _vouch(v, borrower, 1e6);
        }
        address eleventh = makeAddr("v10");
        _register(eleventh);
        usdc.mint(eleventh, 1e6);
        vm.startPrank(eleventh);
        usdc.approve(address(tc), 1e6);
        vm.expectRevert(TrustCircle.TooManyVouchers.selector);
        tc.vouchForUser(borrower, 1e6);
        vm.stopPrank();
    }

    function test_revoke_freesSlotWithSwapAndPop() public {
        address[3] memory vs = [makeAddr("a"), makeAddr("b"), makeAddr("c")];
        for (uint256 i; i < 3; ++i) {
            _register(vs[i]);
            _vouch(vs[i], borrower, 1e6);
        }
        vm.prank(vs[0]);
        tc.revokeVouch(borrower);
        address[] memory list = tc.getVouchers(borrower);
        assertEq(list.length, 2);
        assertEq(list[0], vs[2]);
        assertEq(list[1], vs[1]);
        assertEq(usdc.balanceOf(vs[0]), 1e6);
    }

    function test_withdraw_partial() public {
        _vouch(voucher, borrower, 20e6);
        vm.prank(voucher);
        tc.withdraw(borrower, 5e6);
        assertEq(tc.getVouch(voucher, borrower).amount, 15e6);
        assertEq(usdc.balanceOf(voucher), 5e6);
        assertEq(tc.getVouchers(borrower).length, 1);
    }

    function test_withdraw_moreThanStakeReverts() public {
        _vouch(voucher, borrower, 20e6);
        vm.prank(voucher);
        vm.expectRevert(TrustCircle.InsufficientStake.selector);
        tc.withdraw(borrower, 20e6 + 1);
    }

    function test_revoke_lockedPortionReverts() public {
        _vouch(voucher, borrower, 20e6);
        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        tc.borrow(10e6);

        vm.prank(voucher);
        vm.expectRevert(TrustCircle.VouchLocked.selector);
        tc.revokeVouch(borrower);

        // The unlocked half can still come out.
        vm.prank(voucher);
        tc.withdraw(borrower, 10e6);
        vm.prank(voucher);
        vm.expectRevert(TrustCircle.InsufficientStake.selector);
        tc.withdraw(borrower, 1);
    }

    function test_vouch_topUpWhileLockedReverts() public {
        _vouch(voucher, borrower, 20e6);
        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        tc.borrow(10e6);
        usdc.mint(voucher, 5e6);
        vm.startPrank(voucher);
        usdc.approve(address(tc), 5e6);
        vm.expectRevert(TrustCircle.VouchLocked.selector);
        tc.vouchForUser(borrower, 5e6);
        vm.stopPrank();
    }
}

contract LoanTest is TrustCircleTestBase {
    function setUp() public override {
        super.setUp();
        _register(borrower);
        _register(voucher);
    }

    /// @dev The exact mainnet seed cycle from the build plan.
    function test_seedCycle_matchesPlanNumbers() public {
        _vouch(voucher, borrower, 20e6);
        vm.warp(block.timestamp + DELAY);
        assertEq(tc.availableLimit(borrower), 20e6); // min(100, 20, 40)

        vm.prank(borrower);
        tc.borrow(10e6);
        assertEq(usdc.balanceOf(borrower), 9.9e6);
        assertEq(tc.insurancePool(), 0.1e6);
        assertEq(tc.getVouch(voucher, borrower).locked, 10e6);
        assertEq(tc.availableLimit(borrower), 0); // one loan at a time

        _repay(borrower); // 11.5
        assertEq(tc.claimable(voucher), 1.2e6);
        assertEq(tc.protocolFees(), 0.3e6);
        assertEq(tc.reputation(borrower), 110);
        assertEq(tc.getVouch(voucher, borrower).locked, 0);
        assertEq(uint8(_status(borrower)), uint8(TrustCircle.LoanStatus.Repaid));

        vm.prank(voucher);
        tc.claim();
        assertEq(usdc.balanceOf(voucher), 1.2e6);

        vm.prank(voucher);
        tc.revokeVouch(borrower);
        assertEq(usdc.balanceOf(voucher), 21.2e6);
        _assertSolvent();
    }

    function test_borrow_succeedsAfterVoucherRevokesAllowance() public {
        _vouch(voucher, borrower, 20e6);
        vm.prank(voucher);
        usdc.approve(address(tc), 0);
        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        tc.borrow(10e6);
        assertEq(usdc.balanceOf(borrower), 9.9e6);
    }

    function test_borrow_aboveLimitReverts() public {
        _vouch(voucher, borrower, 20e6);
        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(TrustCircle.ExceedsLimit.selector, 20e6 + 1, 20e6));
        tc.borrow(20e6 + 1);
    }

    function test_borrow_secondLoanReverts() public {
        _vouch(voucher, borrower, 20e6);
        vm.warp(block.timestamp + DELAY);
        vm.startPrank(borrower);
        tc.borrow(5e6);
        vm.expectRevert(TrustCircle.ActiveLoan.selector);
        tc.borrow(1e6);
        vm.stopPrank();
    }

    function test_borrow_notHumanReverts() public {
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(TrustCircle.NotHuman.selector, stranger));
        tc.borrow(1e6);
    }

    function test_borrow_locksProRataAcrossVouchers() public {
        address a = makeAddr("a");
        address b = makeAddr("b");
        address c = makeAddr("c");
        _register(a);
        _register(b);
        _register(c);
        _vouch(a, borrower, 30e6);
        _vouch(b, borrower, 20e6);
        _vouch(c, borrower, 10e6);
        vm.warp(block.timestamp + DELAY);

        vm.prank(borrower);
        tc.borrow(31e6); // 31 * 30/60 = 15.5, 31 * 20/60 = 10.333…, 31 * 10/60 = 5.166…
        uint256 la = tc.getVouch(a, borrower).locked;
        uint256 lb = tc.getVouch(b, borrower).locked;
        uint256 lc = tc.getVouch(c, borrower).locked;
        assertEq(la + lb + lc, 31e6);
        assertApproxEqAbs(la, 15.5e6, 1);
        assertApproxEqAbs(lb, 10_333_333, 1);
        assertApproxEqAbs(lc, 5_166_666, 1);
        assertEq(tc.totalLocked(), 31e6);

        _repay(borrower); // interest 4.65, vouchers 3.72
        uint256 paid = tc.claimable(a) + tc.claimable(b) + tc.claimable(c);
        assertApproxEqAbs(paid, 3.72e6, 3);
        assertEq(paid + tc.protocolFees(), 4.65e6);
        _assertSolvent();
    }

    function test_borrow_inactiveVoucherNotLocked() public {
        address late = makeAddr("late");
        _register(late);
        _vouch(voucher, borrower, 20e6);
        vm.warp(block.timestamp + DELAY);
        _vouch(late, borrower, 20e6); // still in its activation delay
        vm.prank(borrower);
        tc.borrow(20e6);
        assertEq(tc.getVouch(voucher, borrower).locked, 20e6);
        assertEq(tc.getVouch(late, borrower).locked, 0);
    }

    function test_risingTierNeedsTwoVouchers() public {
        // Five on-time repayments take reputation from 100 to 150 (Rising).
        _vouch(voucher, borrower, 40e6);
        vm.warp(block.timestamp + DELAY);
        for (uint256 i; i < 5; ++i) {
            vm.prank(borrower);
            tc.borrow(1e6);
            _repay(borrower);
        }
        assertEq(uint8(tc.tierOf(borrower)), uint8(TrustCircle.Tier.Rising));
        assertEq(tc.availableLimit(borrower), 0); // one voucher, Rising needs two

        address second = makeAddr("second");
        _register(second);
        _vouch(second, borrower, 300e6);
        vm.warp(block.timestamp + DELAY);
        assertEq(tc.availableLimit(borrower), 100e6); // 40 + 200, clipped by the beta per-user max

        vm.prank(owner);
        tc.setBetaConfig(
            TrustCircle.BetaConfig({maxBorrowPerUser: 1_000e6, tvlCap: 50_000e6, maxTierOpen: TrustCircle.Tier.Leader})
        );
        assertEq(tc.availableLimit(borrower), 40e6 + 200e6); // second capped at 40% of 500
    }

    function test_repay_lateGivesNoReputation() public {
        _vouch(voucher, borrower, 20e6);
        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        tc.borrow(10e6);
        vm.warp(block.timestamp + tc.LOAN_DURATION() + 1);
        _repay(borrower);
        assertEq(tc.reputation(borrower), 100);
        assertEq(tc.claimable(voucher), 1.2e6);
    }

    function test_repay_withoutLoanReverts() public {
        vm.prank(borrower);
        vm.expectRevert(TrustCircle.NoActiveLoan.selector);
        tc.repay();
    }

    function test_repay_succeedsWithBlocklistedVoucher() public {
        _vouch(voucher, borrower, 20e6);
        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        tc.borrow(10e6);
        usdc.setBlocked(voucher, true);

        _repay(borrower);
        assertEq(tc.claimable(voucher), 1.2e6);
        assertEq(uint8(_status(borrower)), uint8(TrustCircle.LoanStatus.Repaid));

        vm.prank(voucher);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.Blocklisted.selector, voucher));
        tc.claim(); // only the blocklisted voucher's own claim fails
    }

    function test_claim_nothingReverts() public {
        vm.prank(voucher);
        vm.expectRevert(TrustCircle.NothingToClaim.selector);
        tc.claim();
    }

    function test_withdrawProtocolFees() public {
        _vouch(voucher, borrower, 20e6);
        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        tc.borrow(10e6);
        _repay(borrower);

        address treasury = makeAddr("treasury");
        vm.prank(owner);
        tc.withdrawProtocolFees(treasury);
        assertEq(usdc.balanceOf(treasury), 0.3e6);
        assertEq(tc.protocolFees(), 0);
        _assertSolvent();
    }
}

contract LiquidationTest is TrustCircleTestBase {
    address internal keeper = makeAddr("keeper");

    function setUp() public override {
        super.setUp();
        _register(borrower);
        _register(voucher);
    }

    function _fundInsurance(uint256 loans) internal {
        // Other borrowers' 1% fees fill the insurance pool.
        for (uint256 i; i < loans; ++i) {
            address b = makeAddr(string.concat("ins-b", vm.toString(i)));
            address v = makeAddr(string.concat("ins-v", vm.toString(i)));
            _register(b);
            _register(v);
            _vouch(v, b, 20e6);
            vm.warp(block.timestamp + DELAY);
            vm.prank(b);
            tc.borrow(20e6);
            _repay(b);
        }
    }

    function _defaultLoan(uint256 stake, uint256 amount) internal {
        _vouch(voucher, borrower, stake);
        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        tc.borrow(amount);
        vm.warp(block.timestamp + tc.LOAN_DURATION() + tc.GRACE_PERIOD() + 1);
    }

    function test_liquidate_beforeGraceReverts() public {
        _vouch(voucher, borrower, 20e6);
        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        tc.borrow(10e6);
        vm.warp(block.timestamp + tc.LOAN_DURATION() + tc.GRACE_PERIOD());
        vm.prank(keeper);
        vm.expectRevert(TrustCircle.NotLiquidatable.selector);
        tc.liquidate(borrower);
    }

    function test_liquidate_settlesVouchersAndLeavesPool() public {
        _fundInsurance(5); // 5 × 0.2 = 1 USDC in the pool
        _defaultLoan(20e6, 10e6); // pool 1.1
        assertEq(tc.insurancePool(), 1.1e6);

        vm.prank(keeper);
        tc.liquidate(borrower);

        // No reward, no automatic cover: the unlent 10 USDC is all that comes back.
        assertEq(usdc.balanceOf(keeper), 0);
        assertEq(tc.claimable(voucher), 10e6);
        assertEq(tc.insurancePool(), 1.1e6);
        assertEq(uint8(_status(borrower)), uint8(TrustCircle.LoanStatus.Defaulted));
        assertTrue(tc.hasDefaulted(borrower));
        assertEq(tc.reputation(borrower), 0);
        assertEq(tc.getVouchers(borrower).length, 0);
        assertEq(tc.getVouch(voucher, borrower).amount, 0);
        assertEq(tc.totalDefaulted(), 10e6);
        _assertSolvent();

        vm.prank(borrower);
        vm.expectRevert(TrustCircle.BorrowerDefaulted.selector);
        tc.borrow(1e6);

        vm.prank(voucher);
        vm.expectRevert(TrustCircle.BorrowerDefaulted.selector);
        tc.vouchForUser(borrower, 1e6);
    }

    /// @dev One person with three Device-level identities (voucher, borrower, keeper) defaults to themselves.
    ///      They must not end up with more USDC than they started with.
    function test_liquidate_sybilDefaultGainsNothing() public {
        _fundInsurance(25); // 5 USDC of other people's fees sit in the pool

        uint256 stake = 40e6;
        _vouch(voucher, borrower, stake); // minted: the attacker's own 40 USDC
        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        tc.borrow(40e6);
        vm.warp(block.timestamp + tc.LOAN_DURATION() + tc.GRACE_PERIOD() + 1);

        vm.prank(keeper);
        tc.liquidate(borrower);
        if (tc.claimable(voucher) != 0) {
            vm.prank(voucher);
            tc.claim();
        }

        uint256 attackerAfter = usdc.balanceOf(voucher) + usdc.balanceOf(borrower) + usdc.balanceOf(keeper);
        assertLt(attackerAfter, stake); // lost the 1% fee
        assertEq(tc.insurancePool(), 5.4e6); // pool untouched, plus the attacker's own fee
        _assertSolvent();
    }

    function test_compensate_movesPoolToClaimable() public {
        _fundInsurance(5);
        _defaultLoan(20e6, 10e6);
        vm.prank(keeper);
        tc.liquidate(borrower);

        vm.prank(owner);
        tc.compensate(voucher, 1e6);
        assertEq(tc.claimable(voucher), 11e6);
        assertEq(tc.insurancePool(), 0.1e6);
        _assertSolvent();

        vm.prank(owner);
        vm.expectRevert(TrustCircle.ExceedsInsurancePool.selector);
        tc.compensate(voucher, 0.1e6 + 1);
    }

    function test_compensate_onlyOwner() public {
        vm.prank(voucher);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, voucher));
        tc.compensate(voucher, 0);
    }

    function test_liquidate_succeedsWithBlocklistedVoucher() public {
        _defaultLoan(20e6, 10e6);
        usdc.setBlocked(voucher, true);
        vm.prank(keeper);
        tc.liquidate(borrower);
        assertEq(uint8(_status(borrower)), uint8(TrustCircle.LoanStatus.Defaulted));
        assertGt(tc.claimable(voucher), 0);
    }

    function test_liquidate_tenVouchersGasBounded() public {
        for (uint256 i; i < 10; ++i) {
            address v = makeAddr(string.concat("v", vm.toString(i)));
            _register(v);
            _vouch(v, borrower, 10e6);
        }
        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        tc.borrow(100e6);
        vm.warp(block.timestamp + tc.LOAN_DURATION() + tc.GRACE_PERIOD() + 1);

        uint256 gasBefore = gasleft();
        vm.prank(keeper);
        tc.liquidate(borrower);
        uint256 used = gasBefore - gasleft();
        assertLt(used, 500_000, "liquidation gas");
        _assertSolvent();
    }

    function test_circuitBreaker_haltsBorrowing() public {
        // 10 borrowers × 100 USDC lent = 1,000 USDC volume; two of them default → 20% > 10%.
        address[10] memory bs;
        for (uint256 i; i < 10; ++i) {
            bs[i] = makeAddr(string.concat("cb-b", vm.toString(i)));
            _register(bs[i]);
            for (uint256 j; j < 3; ++j) {
                address v = makeAddr(string.concat("cb-v", vm.toString(i), "-", vm.toString(j)));
                _register(v);
                _vouch(v, bs[i], 40e6);
            }
        }
        vm.warp(block.timestamp + DELAY);
        for (uint256 i; i < 10; ++i) {
            vm.prank(bs[i]);
            tc.borrow(100e6);
        }
        for (uint256 i = 2; i < 10; ++i) {
            _repay(bs[i]);
        }
        assertFalse(tc.isCircuitBreakerTripped());

        vm.warp(block.timestamp + tc.LOAN_DURATION() + tc.GRACE_PERIOD() + 1);
        vm.startPrank(keeper);
        tc.liquidate(bs[0]);
        tc.liquidate(bs[1]);
        vm.stopPrank();
        assertTrue(tc.isCircuitBreakerTripped());

        _vouch(voucher, borrower, 20e6);
        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        vm.expectRevert(TrustCircle.CircuitBreakerTripped.selector);
        tc.borrow(1e6);

        // Exits stay open: repayments, claims and withdrawals still work.
        vm.prank(voucher);
        tc.revokeVouch(borrower);
        _assertSolvent();
    }
}

contract BetaTest is TrustCircleTestBase {
    function setUp() public override {
        super.setUp();
        _register(borrower);
        _register(voucher);
    }

    function _setBeta(uint256 maxBorrow, uint256 tvl, TrustCircle.Tier tier) internal {
        vm.prank(owner);
        tc.setBetaConfig(
            TrustCircle.BetaConfig({maxBorrowPerUser: uint128(maxBorrow), tvlCap: uint128(tvl), maxTierOpen: tier})
        );
    }

    function test_beta_defaultsAreMainnetBetaValues() public view {
        (uint128 maxBorrow, uint128 tvl, TrustCircle.Tier tier) = tc.betaConfig();
        assertEq(maxBorrow, 100e6);
        assertEq(tvl, 2_000e6);
        assertEq(uint8(tier), uint8(TrustCircle.Tier.Rising));
    }

    function test_beta_tvlCapReverts() public {
        _setBeta(100e6, 50e6, TrustCircle.Tier.Rising);
        _vouch(voucher, borrower, 50e6);
        usdc.mint(voucher, 1e6);
        vm.startPrank(voucher);
        usdc.approve(address(tc), 1e6);
        vm.expectRevert(abi.encodeWithSelector(TrustCircle.TvlCapReached.selector, 50e6));
        tc.vouchForUser(borrower, 1e6);
        vm.stopPrank();
    }

    function test_beta_tvlCapFreesUpAfterWithdraw() public {
        _setBeta(100e6, 50e6, TrustCircle.Tier.Rising);
        _vouch(voucher, borrower, 50e6);
        vm.prank(voucher);
        tc.withdraw(borrower, 10e6);
        _vouch(voucher, borrower, 10e6);
        assertEq(tc.totalStaked(), 50e6);
    }

    function test_beta_maxBorrowPerUserClipsLimit() public {
        _setBeta(30e6, 2_000e6, TrustCircle.Tier.Rising);
        _vouch(voucher, borrower, 40e6);
        vm.warp(block.timestamp + DELAY);
        assertEq(tc.availableLimit(borrower), 30e6);
        vm.prank(borrower);
        vm.expectRevert(abi.encodeWithSelector(TrustCircle.ExceedsLimit.selector, 31e6, 30e6));
        tc.borrow(31e6);
    }

    function test_beta_maxTierOpenAppliesLowerTierTerms() public {
        _setBeta(100e6, 2_000e6, TrustCircle.Tier.Newcomer);
        _vouch(voucher, borrower, 40e6);
        vm.warp(block.timestamp + DELAY);
        for (uint256 i; i < 5; ++i) {
            vm.prank(borrower);
            tc.borrow(1e6);
            _repay(borrower);
        }
        assertEq(uint8(tc.tierOf(borrower)), uint8(TrustCircle.Tier.Rising));
        assertEq(uint8(tc.effectiveTierOf(borrower)), uint8(TrustCircle.Tier.Newcomer));
        // Newcomer terms: one voucher is enough and interest stays 15%.
        assertEq(tc.availableLimit(borrower), 40e6);
        vm.prank(borrower);
        tc.borrow(10e6);
        (, uint128 interest,,,) = tc.loans(borrower);
        assertEq(interest, 1.5e6);
    }

    function test_beta_aboveHardCapReverts() public {
        vm.startPrank(owner);
        vm.expectRevert(TrustCircle.AboveHardCap.selector);
        tc.setBetaConfig(
            TrustCircle.BetaConfig({
                maxBorrowPerUser: 1_000e6 + 1, tvlCap: 2_000e6, maxTierOpen: TrustCircle.Tier.Rising
            })
        );
        vm.expectRevert(TrustCircle.AboveHardCap.selector);
        tc.setBetaConfig(
            TrustCircle.BetaConfig({
                maxBorrowPerUser: 100e6, tvlCap: 50_000e6 + 1, maxTierOpen: TrustCircle.Tier.Rising
            })
        );
        vm.stopPrank();
    }

    function test_beta_onlyOwner() public {
        vm.prank(voucher);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, voucher));
        tc.setBetaConfig(
            TrustCircle.BetaConfig({maxBorrowPerUser: 100e6, tvlCap: 2_000e6, maxTierOpen: TrustCircle.Tier.Rising})
        );
    }
}

contract PauseTest is TrustCircleTestBase {
    function setUp() public override {
        super.setUp();
        _register(borrower);
        _register(voucher);
    }

    function test_pause_blocksEntries() public {
        _vouch(voucher, borrower, 20e6);
        vm.warp(block.timestamp + DELAY);
        vm.prank(owner);
        tc.pause();

        address newcomer = makeAddr("newcomer");
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(attesterKey, newcomer, 99, deadline);
        vm.prank(newcomer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        tc.register(99, deadline, sig);

        usdc.mint(voucher, 5e6);
        vm.startPrank(voucher);
        usdc.approve(address(tc), 5e6);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        tc.vouchForUser(borrower, 5e6);
        vm.stopPrank();

        vm.prank(borrower);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        tc.borrow(1e6);

        vm.prank(owner);
        tc.unpause();
        vm.prank(borrower);
        tc.borrow(1e6);
    }

    function test_pause_exitsStayOpen() public {
        address other = makeAddr("other");
        _register(other);
        _vouch(voucher, borrower, 20e6);
        _vouch(voucher, other, 20e6);
        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        tc.borrow(10e6);
        vm.prank(other);
        tc.borrow(10e6);

        vm.prank(owner);
        tc.pause();

        _repay(borrower); // repay
        vm.prank(voucher);
        tc.claim(); // claim
        vm.prank(voucher);
        tc.withdraw(borrower, 20e6); // withdraw

        vm.warp(block.timestamp + tc.LOAN_DURATION() + tc.GRACE_PERIOD() + 1);
        vm.prank(voucher);
        tc.liquidate(other); // liquidate
        assertEq(uint8(_status(other)), uint8(TrustCircle.LoanStatus.Defaulted));
        _assertSolvent();
    }

    function test_pause_onlyOwner() public {
        vm.prank(voucher);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, voucher));
        tc.pause();
    }
}
