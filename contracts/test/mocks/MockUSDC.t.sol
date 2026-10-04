// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {ArcConstants} from "../../src/libraries/ArcConstants.sol";
import {MockUSDC} from "./MockUSDC.sol";

/// @notice Keeps the test mock honest: 6 decimals and an Arc-like blocklist.
contract MockUSDCTest is Test {
    MockUSDC internal usdc;

    function setUp() public {
        usdc = new MockUSDC();
    }

    function test_mockUsdcHasSixDecimals() public view {
        assertEq(usdc.decimals(), ArcConstants.USDC_DECIMALS);
    }

    function test_mockUsdcBlocklistReverts() public {
        address alice = makeAddr("alice");
        usdc.mint(address(this), 1e6);
        usdc.setBlocked(alice, true);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.Blocklisted.selector, alice));
        usdc.transfer(alice, 1e6);
    }
}
