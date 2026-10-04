"use client";

import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { defaultChain } from "@/lib/chains";

export default function ConnectButton() {
  const { address, chainId, isConnected } = useConnection();
  const connectors = useConnectors();
  const { mutate: connect, isPending } = useConnect();
  const { mutate: disconnect } = useDisconnect();
  const { mutate: switchChain } = useSwitchChain();

  if (!isConnected) {
    const connector = connectors[0];
    return (
      <button
        className="rounded-full bg-foreground px-5 py-2 text-background disabled:opacity-50"
        disabled={!connector || isPending}
        onClick={() => connector && connect({ connector, chainId: defaultChain.id })}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  if (chainId !== defaultChain.id) {
    return (
      <button className="rounded-full border px-5 py-2" onClick={() => switchChain({ chainId: defaultChain.id })}>
        Switch to {defaultChain.name}
      </button>
    );
  }

  return (
    <button className="rounded-full border px-5 py-2 font-mono text-sm" onClick={() => disconnect()}>
      {address?.slice(0, 6)}…{address?.slice(-4)}
    </button>
  );
}
