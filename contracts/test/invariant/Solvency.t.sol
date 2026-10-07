// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {TrustCircle} from "../../src/TrustCircle.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/// @notice Drives TrustCircle with random but valid actions from a fixed set of registered humans.
contract Handler is Test {
    TrustCircle internal tc;
    MockUSDC internal usdc;
    address[] public actors;
    // Ghost counters: how many actions actually went through (inspect with -vvv when tuning the handler).
    uint256 public borrows;
    uint256 public repays;
    uint256 public liquidations;

    constructor(TrustCircle tc_, MockUSDC usdc_, address[] memory actors_) {
        tc = tc_;
        usdc = usdc_;
        actors = actors_;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function vouch(uint256 fromSeed, uint256 toSeed, uint256 amount) external {
        address from = _actor(fromSeed);
        address to = _actor(toSeed);
        if (from == to || tc.hasDefaulted(to) || tc.getVouch(from, to).locked != 0) return;
        if (tc.getVouch(from, to).amount == 0 && tc.getVouchers(to).length >= tc.MAX_VOUCHERS_PER_BORROWER()) return;
        (, uint128 tvlCap,) = tc.betaConfig();
        uint256 room = tvlCap - tc.totalStaked();
        if (room < tc.MIN_VOUCH()) return;
        amount = bound(amount, tc.MIN_VOUCH(), room < 200e6 ? room : 200e6);
        usdc.mint(from, amount);
        vm.startPrank(from);
        usdc.approve(address(tc), amount);
        tc.vouchForUser(to, amount);
        vm.stopPrank();
    }

    function withdraw(uint256 fromSeed, uint256 toSeed, uint256 amount) external {
        address from = _actor(fromSeed);
        address to = _actor(toSeed);
        TrustCircle.Vouch memory v = tc.getVouch(from, to);
        uint256 free = v.amount - v.locked;
        if (free == 0) return;
        vm.prank(from);
        tc.withdraw(to, bound(amount, 1, free));
    }

    function reject(uint256 borrowerSeed, uint256 voucherSeed) external {
        address b = _actor(borrowerSeed);
        address v = _actor(voucherSeed);
        TrustCircle.Vouch memory vouch = tc.getVouch(v, b);
        if (vouch.amount == 0 || vouch.locked != 0) return;
        vm.prank(b);
        tc.rejectVouch(v);
    }

    function borrow(uint256 seed, uint256 amount) external {
        address who = _actor(seed);
        uint256 limit = tc.availableLimit(who);
        uint256 minBorrow = tc.MIN_BORROW();
        if (limit < minBorrow || tc.isCircuitBreakerTripped()) return;
        amount = bound(amount, minBorrow, limit); // before the prank: external calls would consume it
        vm.prank(who);
        tc.borrow(amount);
        ++borrows;
    }

    function repay(uint256 seed) external {
        address who = _actor(seed);
        (uint128 principal, uint128 interest,,, TrustCircle.LoanStatus status) = tc.loans(who);
        if (status != TrustCircle.LoanStatus.Active) return;
        uint256 owed = uint256(principal) + interest;
        usdc.mint(who, owed);
        vm.startPrank(who);
        usdc.approve(address(tc), owed);
        tc.repay();
        vm.stopPrank();
        ++repays;
    }

    function liquidate(uint256 seed, uint256 keeperSeed) external {
        address who = _actor(seed);
        address keeper = _actor(keeperSeed);
        (,,, uint64 dueAt, TrustCircle.LoanStatus status) = tc.loans(who);
        if (status != TrustCircle.LoanStatus.Active || keeper == who) return;
        // Let time pass past the grace period so this path is exercised often, not only on long warps.
        if (block.timestamp <= dueAt + tc.GRACE_PERIOD()) vm.warp(dueAt + tc.GRACE_PERIOD() + 1);
        vm.prank(keeper);
        tc.liquidate(who);
        ++liquidations;
    }

    function claim(uint256 seed) external {
        address who = _actor(seed);
        if (tc.claimable(who) == 0) return;
        vm.prank(who);
        tc.claim();
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 40 days));
    }
}

contract SolvencyInvariantTest is Test {
    TrustCircle internal tc;
    MockUSDC internal usdc;
    Handler internal handler;

    function setUp() public {
        (address attester, uint256 attesterKey) = makeAddrAndKey("attester");
        usdc = new MockUSDC();
        tc = new TrustCircle(usdc, attester, 300, address(this));

        address[] memory actors = new address[](6);
        for (uint256 i; i < actors.length; ++i) {
            actors[i] = makeAddr(string.concat("actor", vm.toString(i)));
            uint256 deadline = block.timestamp + 1 hours;
            bytes32 digest = keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    _domainSeparator(),
                    keccak256(abi.encode(tc.ATTEST_TYPEHASH(), actors[i], i + 1, deadline))
                )
            );
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(attesterKey, digest);
            vm.prank(actors[i]);
            tc.register(i + 1, deadline, abi.encodePacked(r, s, v));
        }

        handler = new Handler(tc, usdc, actors);
        targetContract(address(handler));
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("TrustCircle"),
                keccak256("1"),
                block.chainid,
                address(tc)
            )
        );
    }

    /// @notice The contract can always pay every liability it tracks.
    function invariant_solvent() public view {
        uint256 liabilities =
            tc.totalStaked() - tc.totalLocked() + tc.totalClaimable() + tc.insurancePool() + tc.protocolFees();
        assertGe(usdc.balanceOf(address(tc)), liabilities);
    }

    function invariant_lockedNeverExceedsStaked() public view {
        assertLe(tc.totalLocked(), tc.totalStaked());
    }
}
