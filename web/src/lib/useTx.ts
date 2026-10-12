"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Address, Hash } from "viem";
import { useConfig } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { trustCircleActions, type TrustCircleActions } from "./actions";
import { defaultChain } from "./chains";
import { txErrorMessage } from "./errors";
import { trustCircleAddress } from "./trustCircle";

export type TxStep = { label: string; send: () => Promise<Hash> };

export type TxState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "wallet"; label: string }
  | { status: "confirming"; label: string; hash: Hash }
  | { status: "success"; hash: Hash }
  | { status: "error"; message: string };

/**
 * Runs one user action as a sequence of transactions (for example approve, then vouch), waiting for each
 * to be included before sending the next, and refreshes every on-chain read afterwards.
 */
export function useTx(account: Address) {
  const config = useConfig();
  const queryClient = useQueryClient();
  const [state, setState] = useState<TxState>({ status: "idle" });

  /** Resolves to true when every step was included successfully. */
  async function run(plan: (actions: TrustCircleActions) => TxStep[] | Promise<TxStep[]>): Promise<boolean> {
    if (!trustCircleAddress) return false;
    setState({ status: "preparing" });
    try {
      let last: Hash | undefined;
      for (const step of await plan(trustCircleActions(config, account, trustCircleAddress))) {
        setState({ status: "wallet", label: step.label });
        const hash = await step.send();
        setState({ status: "confirming", label: step.label, hash });
        const receipt = await waitForTransactionReceipt(config, { hash, chainId: defaultChain.id });
        if (receipt.status !== "success") throw new Error(`The "${step.label}" transaction failed.`);
        last = hash;
      }
      setState(last ? { status: "success", hash: last } : { status: "idle" });
      return true;
    } catch (error) {
      setState({ status: "error", message: txErrorMessage(error) });
      return false;
    } finally {
      await queryClient.invalidateQueries();
    }
  }

  const busy = state.status === "preparing" || state.status === "wallet" || state.status === "confirming";
  return { state, busy, run };
}

/** `approve` (only when the current allowance is too small) followed by the call that spends the USDC. */
export async function withUsdcApproval(actions: TrustCircleActions, amount: bigint, spend: TxStep): Promise<TxStep[]> {
  if ((await actions.usdcAllowance()) >= amount) return [spend];
  return [
    { label: "Approve USDC", send: () => actions.approveUsdc(amount) },
    {
      label: spend.label,
      async send() {
        // The spend is simulated before it is sent. An RPC node that is a block behind would still report
        // the old allowance and fail that simulation, so wait until the approval is visible.
        for (let attempt = 0; attempt < 10 && (await actions.usdcAllowance()) < amount; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        return spend.send();
      },
    },
  ];
}
