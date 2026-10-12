import { formatUnits, parseUnits, type Address } from "viem";
import { USDC_DECIMALS } from "./contracts";

/** Contract amounts are ERC-20 USDC (6 decimals). Never mix with native (18) balances. */
export const formatUsdc = (amount: bigint) => formatUnits(amount, USDC_DECIMALS);
export const parseUsdc = (value: string) => parseUnits(value, USDC_DECIMALS);

/** For display: at least two decimals, up to six ("4.95", "5.00", "0.123456"). */
export function displayUsdc(amount: bigint): string {
  const [whole, fraction = ""] = formatUsdc(amount).split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

/** Rounded down to cents, for wallet balances: gas is paid in USDC, so they always carry dust. */
export const displayBalance = (amount: bigint) => displayUsdc(amount - (amount % 10_000n));

/** Parses what a user typed into an amount field: a plain decimal with at most six places, or null. */
export function tryParseUsdc(value: string): bigint | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{0,6})?$/.test(normalized)) return null;
  return parseUsdc(normalized);
}

export const shortAddress = (address: Address) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export function formatDuration(seconds: number): string {
  if (seconds < 60) return "less than a minute";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} days`;
}

/** A fixed locale keeps the text the same wherever it is rendered. */
export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
