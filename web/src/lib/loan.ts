/** Loan and vouch maths, mirroring the rounding in contracts/src/TrustCircle.sol. */

import { displayUsdc, formatDuration } from "./format";

const BPS = 10_000n;

export const TIER_NAMES = ["Newcomer", "Rising", "Trusted", "Leader"] as const;

/** TrustCircle.LoanStatus */
export const LoanStatus = { None: 0, Active: 1, Repaid: 2, Defaulted: 3 } as const;

export type Loan = { principal: bigint; interest: bigint; startedAt: number; dueAt: number; status: number };
export type Vouch = { amount: bigint; locked: bigint; activatesAt: number };

/** What `borrow(amount)` pays out and what `repay()` will collect. */
export function quoteBorrow(amount: bigint, interestBps: bigint, insuranceFeeBps: bigint) {
  const fee = (amount * insuranceFeeBps) / BPS;
  const interest = (amount * interestBps) / BPS;
  return { fee, received: amount - fee, interest, owed: amount + interest };
}

/** The most a single voucher's stake adds to a borrower's limit. */
export function voucherCap(tierMaxBorrow: bigint, maxVoucherShareBps: bigint): bigint {
  return (tierMaxBorrow * maxVoucherShareBps) / BPS;
}

export type LoanPhase = "none" | "active" | "overdue" | "liquidatable" | "repaid" | "defaulted";

/**
 * An open loan is `overdue` after its due date (repaying no longer earns reputation) and `liquidatable`
 * after the grace period (anyone can close it as a default). It can be repaid in all three phases.
 */
export function loanPhase(loan: Loan, now: number, gracePeriod: number): LoanPhase {
  if (loan.status === LoanStatus.Repaid) return "repaid";
  if (loan.status === LoanStatus.Defaulted) return "defaulted";
  if (loan.status !== LoanStatus.Active) return "none";
  if (now <= loan.dueAt) return "active";
  return now <= loan.dueAt + gracePeriod ? "overdue" : "liquidatable";
}

export type VouchPhase = "lent" | "activating" | "active";

export function vouchPhase(vouch: Vouch, now: number): VouchPhase {
  if (vouch.locked > 0n) return "lent";
  return now < vouch.activatesAt ? "activating" : "active";
}

/** A vouch's state in a few words. `now` is undefined until the chain's clock has loaded. */
export function vouchLabel(vouch: Vouch, now: number | undefined): string {
  if (vouch.locked > 0n) return `${displayUsdc(vouch.locked)} USDC lent`;
  if (now === undefined) return "";
  return now < vouch.activatesAt ? `Active in ${formatDuration(vouch.activatesAt - now)}` : "Active";
}
