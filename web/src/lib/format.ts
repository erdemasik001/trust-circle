import { formatUnits, parseUnits } from "viem";
import { USDC_DECIMALS } from "./contracts";

/** Contract amounts are ERC-20 USDC (6 decimals). Never mix with native (18) balances. */
export const formatUsdc = (amount: bigint) => formatUnits(amount, USDC_DECIMALS);
export const parseUsdc = (value: string) => parseUnits(value, USDC_DECIMALS);
