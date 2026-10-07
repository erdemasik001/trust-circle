import type { Address, Hash } from "viem";
import { trustCircleAbi } from "./abi/trustCircle";
import { defaultChain } from "./chains";
import { deployments } from "./contracts";

export { trustCircleAbi };

/** The TrustCircle deployment on the chain this build targets (NEXT_PUBLIC_ARC_NETWORK). */
export const trustCircleAddress: Address | undefined = deployments[defaultChain.id].trustCircle;

export function txUrl(hash: Hash): string {
  return `${defaultChain.blockExplorers.default.url}/tx/${hash}`;
}

export function addressUrl(address: Address): string {
  return `${defaultChain.blockExplorers.default.url}/address/${address}`;
}
