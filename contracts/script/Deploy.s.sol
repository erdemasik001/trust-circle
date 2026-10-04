// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {ArcConstants} from "../src/libraries/ArcConstants.sol";

/// @notice Deploys and wires the core Trust Circle contracts.
///   forge script script/Deploy.s.sol --rpc-url arc_testnet --account deployer --broadcast --verify
/// TODO(G2): deploy TrustCircle with USDC, ATTESTER and ACTIVATION_DELAY read from env.
contract Deploy is Script {
    function run() external view {
        require(
            block.chainid == ArcConstants.TESTNET_CHAIN_ID || block.chainid == ArcConstants.MAINNET_CHAIN_ID,
            "not an Arc chain"
        );
        console2.log("chain", block.chainid);
        console2.log("usdc", ArcConstants.USDC);
    }
}
