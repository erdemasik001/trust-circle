import type { Address } from "viem";
import { arc, arcTestnet, type SupportedChainId } from "./chains";

/** USDC ERC-20 interface on Arc: 6 decimals, same balance as native gas USDC (18 decimals). */
export const USDC: Address = "0x3600000000000000000000000000000000000000";
export const USDC_DECIMALS = 6;

type Deployment = { trustCircle?: Address };

// Filled in after deploy (testnet G3, mainnet G4).
export const deployments: Record<SupportedChainId, Deployment> = {
  [arc.id]: {},
  [arcTestnet.id]: { trustCircle: "0xe4b2F7fDb7960160C8003409c2a9eb97046A0b06" },
};
