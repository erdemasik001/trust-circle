// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Arc network constants (docs.arc.io/arc/references).
library ArcConstants {
    uint256 internal constant MAINNET_CHAIN_ID = 5042;
    uint256 internal constant TESTNET_CHAIN_ID = 5042002;

    /// @dev USDC ERC-20 interface (6 decimals). Same balance as native gas USDC (18 decimals).
    address internal constant USDC = 0x3600000000000000000000000000000000000000;

    uint8 internal constant USDC_DECIMALS = 6;
}
