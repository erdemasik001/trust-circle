import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";
import { displayUsdc } from "./format";

/** TrustCircle custom errors, in words a member can act on. */
const revertMessages: Record<string, (args: readonly unknown[]) => string> = {
  NotHuman: () => "That wallet is not registered as a verified human yet.",
  SelfVouch: () => "You cannot vouch for yourself.",
  BorrowerDefaulted: () => "This member has defaulted, so they can no longer borrow or be vouched for.",
  VouchTooSmall: () => "The smallest vouch is 1 USDC.",
  TooManyVouchers: () => "This member already has the maximum number of vouchers.",
  VouchLocked: () => "Part of this stake is lent out. It unlocks when the loan is repaid.",
  InsufficientStake: () => "Only the part of a stake that is not lent out can be withdrawn.",
  ActiveLoan: () => "You already have an open loan. Repay it first.",
  NoActiveLoan: () => "There is no open loan to repay.",
  ZeroAmount: () => "Enter an amount.",
  BorrowTooSmall: () => "The smallest loan is 1 USDC.",
  NoVouch: () => "There is no vouch from that wallet.",
  ExceedsLimit: ([, limit]) => `You can borrow up to ${displayUsdc(limit as bigint)} USDC right now.`,
  CircuitBreakerTripped: () => "Borrowing is halted because too many loans have defaulted.",
  NotLiquidatable: () => "This loan is not past its grace period yet.",
  NothingToClaim: () => "There is nothing to claim.",
  TvlCapReached: ([cap]) => `The beta is full: total stakes are capped at ${displayUsdc(cap as bigint)} USDC.`,
  EnforcedPause: () => "New registrations, vouches and loans are paused.",
};

/** One line to show under a failed action. */
export function txErrorMessage(error: unknown): string {
  if (!(error instanceof BaseError)) return error instanceof Error ? error.message : String(error);
  if (error.walk((e) => e instanceof UserRejectedRequestError)) return "You rejected the request in your wallet.";

  const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
  if (revert instanceof ContractFunctionRevertedError) {
    const message = revert.data && revertMessages[revert.data.errorName];
    if (message) return message(revert.data?.args ?? []);
    if (revert.data) return `The contract refused this: ${revert.data.errorName}.`;
    if (revert.reason) return revert.reason;
  }
  return error.shortMessage;
}
