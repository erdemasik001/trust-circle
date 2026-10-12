"use client";

import { useState, useEffect } from "react";
import { erc20Abi, type Address, type ReadContractReturnType } from "viem";
import { useBlock, useReadContracts } from "wagmi";
import { defaultChain } from "./chains";
import { USDC } from "./contracts";
import type { Loan, Vouch } from "./loan";
import { trustCircleAbi, trustCircleAddress } from "./trustCircle";

const chainId = defaultChain.id;
const tc = { address: trustCircleAddress, abi: trustCircleAbi, chainId } as const;

const REFRESH_MS = 30_000;

/** Everything the contract knows about one account, plus its USDC balance. */
export function useMember(account: Address | undefined) {
  const args = [account!] as const;
  return useReadContracts({
    allowFailure: false,
    contracts: [
      { ...tc, functionName: "isHuman", args },
      { ...tc, functionName: "reputation", args },
      { ...tc, functionName: "effectiveTierOf", args },
      { ...tc, functionName: "hasDefaulted", args },
      { ...tc, functionName: "loans", args },
      { ...tc, functionName: "availableLimit", args },
      { ...tc, functionName: "getVouchers", args },
      { ...tc, functionName: "claimable", args },
      { address: USDC, abi: erc20Abi, chainId, functionName: "balanceOf", args },
    ],
    query: {
      enabled: Boolean(account && trustCircleAddress),
      refetchInterval: REFRESH_MS,
      select: ([isHuman, reputation, tier, hasDefaulted, loan, availableLimit, vouchers, claimable, balance]) => ({
        isHuman,
        reputation,
        tier,
        hasDefaulted,
        loan: {
          principal: loan[0],
          interest: loan[1],
          startedAt: Number(loan[2]),
          dueAt: Number(loan[3]),
          status: loan[4],
        } satisfies Loan,
        availableLimit,
        vouchers,
        claimable,
        balance,
      }),
    },
  });
}

export type Member = NonNullable<ReturnType<typeof useMember>["data"]>;

/** Contract-wide settings and constants. They are read from the chain so the UI cannot drift from the deployment. */
export function useProtocol() {
  return useReadContracts({
    allowFailure: false,
    contracts: [
      { ...tc, functionName: "paused" },
      { ...tc, functionName: "activationDelay" },
      { ...tc, functionName: "betaConfig" },
      { ...tc, functionName: "MIN_VOUCH" },
      { ...tc, functionName: "MIN_BORROW" },
      { ...tc, functionName: "INSURANCE_FEE_BPS" },
      { ...tc, functionName: "MAX_VOUCHER_SHARE_BPS" },
      { ...tc, functionName: "VOUCHER_INTEREST_BPS" },
      { ...tc, functionName: "LOAN_DURATION" },
      { ...tc, functionName: "GRACE_PERIOD" },
      { ...tc, functionName: "tierParams", args: [0] },
      { ...tc, functionName: "tierParams", args: [1] },
      { ...tc, functionName: "tierParams", args: [2] },
      { ...tc, functionName: "tierParams", args: [3] },
    ],
    query: {
      enabled: Boolean(trustCircleAddress),
      staleTime: REFRESH_MS,
      select: ([paused, activationDelay, beta, minVouch, minBorrow, feeBps, shareBps, voucherBps, duration, grace, ...tiers]) => ({
        paused,
        activationDelay: Number(activationDelay),
        maxBorrowPerUser: beta[0],
        minVouch,
        minBorrow,
        insuranceFeeBps: feeBps,
        maxVoucherShareBps: shareBps,
        voucherInterestBps: voucherBps,
        loanDuration: Number(duration),
        gracePeriod: Number(grace),
        tiers,
      }),
    },
  });
}

export type Protocol = NonNullable<ReturnType<typeof useProtocol>["data"]>;

export type VouchPair = { voucher: Address; borrower: Address };
type RawVouch = ReadContractReturnType<typeof trustCircleAbi, "getVouch">;

/** The stake behind each (voucher, borrower) pair, in the order given. */
export function useVouches(pairs: readonly VouchPair[]) {
  return useReadContracts({
    allowFailure: false,
    contracts: pairs.map(({ voucher, borrower }) => ({ ...tc, functionName: "getVouch", args: [voucher, borrower] }) as const),
    query: {
      enabled: Boolean(trustCircleAddress) && pairs.length > 0,
      refetchInterval: REFRESH_MS,
      // A list built at runtime is not inferred from the ABI the way a fixed tuple is.
      select: (vouches): (Vouch & VouchPair)[] =>
        (vouches as RawVouch[]).map((v, i) => ({ ...pairs[i], amount: v.amount, locked: v.locked, activatesAt: Number(v.activatesAt) })),
    },
  });
}

/**
 * The chain's clock in unix seconds: the latest block's timestamp, advanced locally between refreshes.
 * Deadlines are compared against this rather than the device clock, which the contract never sees.
 */
export function useChainNow(): number | undefined {
  const block = useBlock({ chainId, query: { refetchInterval: REFRESH_MS } });
  const [localNow, setLocalNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setLocalNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  if (!block.data) return undefined;
  const sinceFetch = Math.max(0, Math.floor((localNow - block.dataUpdatedAt) / 1000));
  return Number(block.data.timestamp) + sinceFetch;
}
