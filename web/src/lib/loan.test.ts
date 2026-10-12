import { describe, expect, it } from "vitest";
import { LoanStatus, loanPhase, quoteBorrow, vouchLabel, vouchPhase, voucherCap, type Loan } from "./loan";

const usdc = (n: number) => BigInt(Math.round(n * 1e6));
const DAY = 24 * 60 * 60;

describe("quoteBorrow", () => {
  it("matches the testnet rehearsal: 5 USDC at Newcomer terms", () => {
    expect(quoteBorrow(usdc(5), 1_500n, 100n)).toEqual({
      fee: usdc(0.05),
      received: usdc(4.95),
      interest: usdc(0.75),
      owed: usdc(5.75),
    });
  });

  it("rounds fee and interest down like the contract", () => {
    // 1.000001 USDC: 1% = 10000.01 -> 10000, 15% = 150000.15 -> 150000
    expect(quoteBorrow(1_000_001n, 1_500n, 100n)).toEqual({
      fee: 10_000n,
      received: 990_001n,
      interest: 150_000n,
      owed: 1_150_001n,
    });
  });
});

describe("voucherCap", () => {
  it("is 40% of the tier maximum", () => {
    expect(voucherCap(usdc(100), 4_000n)).toBe(usdc(40));
  });
});

describe("loanPhase", () => {
  const dueAt = 1_000_000;
  const loan = (status: number): Loan => ({ principal: usdc(5), interest: usdc(0.75), startedAt: dueAt - 30 * DAY, dueAt, status });
  const grace = 7 * DAY;

  it("follows the loan status when it is not open", () => {
    expect(loanPhase(loan(LoanStatus.None), dueAt, grace)).toBe("none");
    expect(loanPhase(loan(LoanStatus.Repaid), dueAt + 99 * DAY, grace)).toBe("repaid");
    expect(loanPhase(loan(LoanStatus.Defaulted), dueAt, grace)).toBe("defaulted");
  });

  it("is on time up to and including the due date", () => {
    expect(loanPhase(loan(LoanStatus.Active), dueAt, grace)).toBe("active");
  });

  it("is overdue through the grace period, then liquidatable, with the contract's boundaries", () => {
    expect(loanPhase(loan(LoanStatus.Active), dueAt + 1, grace)).toBe("overdue");
    expect(loanPhase(loan(LoanStatus.Active), dueAt + grace, grace)).toBe("overdue");
    expect(loanPhase(loan(LoanStatus.Active), dueAt + grace + 1, grace)).toBe("liquidatable");
  });
});

describe("vouch state", () => {
  const vouch = { amount: usdc(10), locked: 0n, activatesAt: 5_000 };

  it("waits until the activation time", () => {
    expect(vouchPhase(vouch, 4_999)).toBe("activating");
    expect(vouchPhase(vouch, 5_000)).toBe("active");
  });

  it("is lent while any of it is locked", () => {
    expect(vouchPhase({ ...vouch, locked: usdc(5) }, 9_999)).toBe("lent");
  });

  it("is described in words", () => {
    expect(vouchLabel(vouch, 5_000 - 47 * 3600 - 12 * 60)).toBe("Active in 47 h 12 min");
    expect(vouchLabel(vouch, 5_000)).toBe("Active");
    expect(vouchLabel({ ...vouch, locked: usdc(5) }, 5_000)).toBe("5.00 USDC lent");
    expect(vouchLabel(vouch, undefined)).toBe("");
  });
});
