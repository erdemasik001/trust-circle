// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ArcConstants} from "../../src/libraries/ArcConstants.sol";

/// @notice Runs against real Arc USDC. Skipped unless ARC_TESTNET_RPC_URL is set.
///         arc-forge test --match-path 'test/fork/*' --network arc
contract ArcUsdcForkTest is Test {
    function setUp() public {
        string memory rpc = vm.envOr("ARC_TESTNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) vm.skip(true);
        vm.createSelectFork(rpc);
    }

    function test_usdcErc20InterfaceHasSixDecimals() public view {
        assertEq(block.chainid, ArcConstants.TESTNET_CHAIN_ID);
        assertEq(IERC20Metadata(ArcConstants.USDC).decimals(), ArcConstants.USDC_DECIMALS);
    }
}
