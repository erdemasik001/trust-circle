import { erc20Abi, type Address, type Hash } from "viem";
import { readContract, simulateContract, writeContract } from "wagmi/actions";
import { defaultChain } from "./chains";
import { USDC } from "./contracts";
import { trustCircleAbi } from "./trustCircle";
import type { wagmiConfig } from "./wagmi";

/**
 * Every state-changing call a member can make. Each one is simulated first, so a revert surfaces as the
 * contract's own error (see errors.ts) before the wallet is asked to sign anything.
 */
export function trustCircleActions(config: typeof wagmiConfig, account: Address, trustCircle: Address) {
  const chainId = defaultChain.id;
  const tc = { address: trustCircle, abi: trustCircleAbi, account, chainId } as const;
  const usdc = { address: USDC, abi: erc20Abi, account, chainId } as const;

  return {
    usdcAllowance(): Promise<bigint> {
      return readContract(config, { ...usdc, functionName: "allowance", args: [account, trustCircle] });
    },
    async approveUsdc(amount: bigint): Promise<Hash> {
      const { request } = await simulateContract(config, { ...usdc, functionName: "approve", args: [trustCircle, amount] });
      return writeContract(config, request);
    },
    async vouch(borrower: Address, amount: bigint): Promise<Hash> {
      const { request } = await simulateContract(config, { ...tc, functionName: "vouchForUser", args: [borrower, amount] });
      return writeContract(config, request);
    },
    async withdraw(borrower: Address, amount: bigint): Promise<Hash> {
      const { request } = await simulateContract(config, { ...tc, functionName: "withdraw", args: [borrower, amount] });
      return writeContract(config, request);
    },
    async rejectVouch(voucher: Address): Promise<Hash> {
      const { request } = await simulateContract(config, { ...tc, functionName: "rejectVouch", args: [voucher] });
      return writeContract(config, request);
    },
    async borrow(amount: bigint): Promise<Hash> {
      const { request } = await simulateContract(config, { ...tc, functionName: "borrow", args: [amount] });
      return writeContract(config, request);
    },
    async repay(): Promise<Hash> {
      const { request } = await simulateContract(config, { ...tc, functionName: "repay" });
      return writeContract(config, request);
    },
    async liquidate(borrower: Address): Promise<Hash> {
      const { request } = await simulateContract(config, { ...tc, functionName: "liquidate", args: [borrower] });
      return writeContract(config, request);
    },
    async claim(): Promise<Hash> {
      const { request } = await simulateContract(config, { ...tc, functionName: "claim" });
      return writeContract(config, request);
    },
  };
}

export type TrustCircleActions = ReturnType<typeof trustCircleActions>;
