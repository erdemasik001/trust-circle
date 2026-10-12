import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, encodeErrorResult } from "viem";
import { describe, expect, it } from "vitest";
import { trustCircleAbi } from "./abi/trustCircle";
import { txErrorMessage } from "./errors";

/** What viem throws when a simulated call reverts with one of the contract's custom errors. */
function revert(errorName: string, args?: readonly unknown[]) {
  const data = encodeErrorResult({ abi: trustCircleAbi, errorName, args } as Parameters<typeof encodeErrorResult>[0]);
  const cause = new ContractFunctionRevertedError({ abi: trustCircleAbi, data, functionName: "borrow" });
  return new BaseError("The contract function reverted.", { cause });
}

describe("txErrorMessage", () => {
  it("explains a custom error using its arguments", () => {
    expect(txErrorMessage(revert("ExceedsLimit", [50_000_000n, 10_000_000n]))).toBe("You can borrow up to 10.00 USDC right now.");
    expect(txErrorMessage(revert("TvlCapReached", [2_000_000_000n]))).toBe(
      "The beta is full: total stakes are capped at 2000.00 USDC.",
    );
  });

  it("explains errors without arguments", () => {
    expect(txErrorMessage(revert("SelfVouch"))).toBe("You cannot vouch for yourself.");
    expect(txErrorMessage(revert("EnforcedPause"))).toBe("New registrations, vouches and loans are paused.");
  });

  it("recognises a rejection in the wallet", () => {
    const error = new BaseError("failed", { cause: new UserRejectedRequestError(new Error("User denied")) });
    expect(txErrorMessage(error)).toBe("You rejected the request in your wallet.");
  });

  it("names an error it has no words for", () => {
    expect(txErrorMessage(revert("ZeroAddress"))).toBe("The contract refused this: ZeroAddress.");
    expect(txErrorMessage(new Error("network down"))).toBe("network down");
  });
});
