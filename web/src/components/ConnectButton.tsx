"use client";

import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui";
import { defaultChain } from "@/lib/chains";
import { shortAddress } from "@/lib/format";

export default function ConnectButton() {
  const { address, chainId, isConnected } = useConnection();
  const connectors = useConnectors();
  const { mutate: connect, isPending } = useConnect();
  const { mutate: disconnect } = useDisconnect();
  const { mutate: switchChain } = useSwitchChain();

  if (!isConnected || !address) {
    const connector = connectors[0];
    return (
      <Button className="whitespace-nowrap" disabled={!connector || isPending} onClick={() => connector && connect({ connector, chainId: defaultChain.id })}>
        {isPending ? "Connecting…" : "Connect wallet"}
      </Button>
    );
  }

  if (chainId !== defaultChain.id) {
    return (
      <Button variant="secondary" className="whitespace-nowrap border-warning/50 text-warning" onClick={() => switchChain({ chainId: defaultChain.id })}>
        Switch to {defaultChain.name}
      </Button>
    );
  }

  return (
    <Button variant="secondary" className="whitespace-nowrap font-mono" title="Disconnect" onClick={() => disconnect()}>
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      {shortAddress(address)}
    </Button>
  );
}
