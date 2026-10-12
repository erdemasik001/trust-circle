import { createConfig, http, injected } from "wagmi";
import { arc, arcTestnet } from "./chains";

export const wagmiConfig = createConfig({
  chains: [arcTestnet, arc],
  connectors: [injected()],
  // Arc finalises a block in under a second; viem's 4 s default would make every confirmation feel slow.
  pollingInterval: 1_000,
  transports: {
    [arc.id]: http(process.env.NEXT_PUBLIC_ARC_MAINNET_RPC_URL),
    [arcTestnet.id]: http(process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
