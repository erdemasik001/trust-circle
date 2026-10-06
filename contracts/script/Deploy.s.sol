// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TrustCircle} from "../src/TrustCircle.sol";
import {ArcConstants} from "../src/libraries/ArcConstants.sol";

/// @notice Deploys TrustCircle with the default beta config and records the address in deployments/.
///
///   ATTESTER=0x… ACTIVATION_DELAY=300 \
///   forge script script/Deploy.s.sol --rpc-url arc_testnet --account deployer --broadcast --verify
///
/// Env: ATTESTER (required), ACTIVATION_DELAY (required; mainnet must be 172800),
///      OWNER (default: the deployer), USDC (default: Arc USDC).
contract Deploy is Script {
    uint256 internal constant MAINNET_ACTIVATION_DELAY = 48 hours;

    function run() external returns (TrustCircle tc) {
        bool mainnet = block.chainid == ArcConstants.MAINNET_CHAIN_ID;
        require(mainnet || block.chainid == ArcConstants.TESTNET_CHAIN_ID, "not an Arc chain");

        address attester = vm.envAddress("ATTESTER");
        uint256 activationDelay = vm.envUint("ACTIVATION_DELAY");
        address usdc = vm.envOr("USDC", ArcConstants.USDC);
        if (mainnet) require(activationDelay == MAINNET_ACTIVATION_DELAY, "mainnet needs a 48h activation delay");

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        address owner = vm.envOr("OWNER", deployer);
        tc = new TrustCircle(IERC20(usdc), attester, activationDelay, owner);
        vm.stopBroadcast();

        console2.log("TrustCircle", address(tc));
        console2.log("owner", owner);
        console2.log("attester", attester);
        console2.log("activationDelay", activationDelay);

        // Only a real broadcast is recorded; a simulation must not leave a fake deployment behind.
        if (!vm.isContext(VmSafe.ForgeContext.ScriptBroadcast)) return tc;

        string memory json = "deployment";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "usdc", usdc);
        vm.serializeAddress(json, "attester", attester);
        vm.serializeAddress(json, "owner", owner);
        vm.serializeUint(json, "activationDelay", activationDelay);
        string memory out = vm.serializeAddress(json, "trustCircle", address(tc));
        vm.writeJson(out, string.concat("deployments/", mainnet ? "arc-mainnet" : "arc-testnet", ".json"));
    }
}
