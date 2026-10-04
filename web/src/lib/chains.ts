import { arc, arcTestnet as viemArcTestnet } from "viem/chains";
import { defineChain } from "viem";

// viem ships the testnet on the old arc.network hosts; docs.arc.io now lists arc.io.
export const arcTestnet = defineChain({
  ...viemArcTestnet,
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"], webSocket: ["wss://rpc.testnet.arc.io"] } },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.testnet.arc.io", apiUrl: "https://explorer.testnet.arc.io/api" },
  },
});

export { arc };

export const chains = [arc, arcTestnet] as const;
export type SupportedChainId = (typeof chains)[number]["id"];

export const defaultChain = process.env.NEXT_PUBLIC_ARC_NETWORK === "mainnet" ? arc : arcTestnet;
