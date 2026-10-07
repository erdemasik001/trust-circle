// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TrustCircle} from "../../src/TrustCircle.sol";
import {ArcConstants} from "../../src/libraries/ArcConstants.sol";

/// @notice The full loan cycle against Arc's real USDC on a fork of Arc testnet.
/// @dev Arc USDC is a system contract whose ERC-20 interface (6 decimals) and native gas balance
///      (18 decimals) are one balance, and transfers go through an Arc precompile. Plain Foundry cannot
///      execute it, so this suite skips itself there; run it with Arc Foundry:
///        arc-forge test --match-path 'test/fork/*' --network arc
contract TrustCircleCycleForkTest is Test {
    uint256 internal constant DELAY = 300;
    IERC20 internal constant USDC = IERC20(ArcConstants.USDC);

    TrustCircle internal tc;
    uint256 internal attesterKey;
    address internal voucher = makeAddr("fork-voucher");
    address internal borrower = makeAddr("fork-borrower");
    address internal keeper = makeAddr("fork-keeper");

    function setUp() public {
        string memory rpc = vm.envOr("ARC_TESTNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) vm.skip(true);
        vm.createSelectFork(rpc);

        // Skip on an EVM without Arc's USDC precompile (plain Foundry): there every transfer reverts.
        address probe = makeAddr("probe");
        vm.deal(probe, 1e18);
        vm.prank(probe);
        try USDC.transfer(address(1), 1) {}
        catch {
            vm.skip(true);
        }

        address attester;
        (attester, attesterKey) = makeAddrAndKey("fork-attester");
        tc = new TrustCircle(USDC, attester, DELAY, address(this));
        _register(voucher, 1);
        _register(borrower, 2);
        _register(keeper, 3);
    }

    function _register(address who, uint256 nullifier) internal {
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("TrustCircle"),
                keccak256("1"),
                block.chainid,
                address(tc)
            )
        );
        bytes32 structHash = keccak256(abi.encode(tc.ATTEST_TYPEHASH(), who, nullifier, deadline));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(attesterKey, keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash)));
        vm.prank(who);
        tc.register(nullifier, deadline, abi.encodePacked(r, s, v));
    }

    /// @dev USDC on Arc: native balance in 18 decimals. vm.deal is how a fork funds an account.
    function _fund(address who, uint256 usdc6) internal {
        vm.deal(who, who.balance + usdc6 * 1e12);
    }

    function _vouch(uint256 amount) internal {
        _fund(voucher, amount);
        vm.startPrank(voucher);
        USDC.approve(address(tc), amount);
        tc.vouchForUser(borrower, amount);
        vm.stopPrank();
    }

    function test_fork_cycleWithRealUsdc() public {
        _vouch(2e6);
        assertEq(USDC.balanceOf(address(tc)), 2e6);
        assertEq(USDC.balanceOf(voucher), 0);

        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        tc.borrow(1e6);
        assertEq(USDC.balanceOf(borrower), 0.99e6);
        assertEq(borrower.balance, 0.99e18); // the same money, seen as native gas balance

        _fund(borrower, 0.16e6); // interest top-up
        vm.startPrank(borrower);
        USDC.approve(address(tc), 1.15e6);
        tc.repay();
        vm.stopPrank();
        assertEq(tc.reputation(borrower), 110);
        assertEq(tc.claimable(voucher), 0.12e6);

        vm.startPrank(voucher);
        tc.claim();
        tc.revokeVouch(borrower);
        vm.stopPrank();
        assertEq(USDC.balanceOf(voucher), 2.12e6);

        // Left in the contract: 0.01 insurance + 0.03 protocol fee.
        assertEq(USDC.balanceOf(address(tc)), 0.04e6);
        assertEq(address(tc).balance, 0.04e18);
        tc.withdrawProtocolFees(address(this));
        assertEq(USDC.balanceOf(address(tc)), tc.insurancePool());
    }

    function test_fork_liquidationWithRealUsdc() public {
        _vouch(3e6);
        vm.warp(block.timestamp + DELAY);
        vm.prank(borrower);
        tc.borrow(2e6);

        vm.warp(block.timestamp + tc.LOAN_DURATION() + tc.GRACE_PERIOD() + 1);
        vm.prank(keeper);
        tc.liquidate(borrower);

        vm.prank(voucher);
        tc.claim(); // the 1 USDC that was never lent out
        assertEq(USDC.balanceOf(voucher), 1e6);
        assertEq(USDC.balanceOf(address(tc)), tc.insurancePool());
    }
}
