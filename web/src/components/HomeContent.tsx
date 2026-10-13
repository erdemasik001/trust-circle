"use client";

import Link from "next/link";
import type { Address } from "viem";
import { useConnection } from "wagmi";
import Dashboard from "@/components/Dashboard";
import { ChevronRight } from "@/components/icons";
import Landing from "@/components/Landing";
import { Card, Notice, buttonClass } from "@/components/ui";
import { defaultChain } from "@/lib/chains";
import { trustCircleAddress } from "@/lib/trustCircle";
import { useMember } from "@/lib/useTrustCircle";

/** The landing page for visitors, the register prompt for new wallets, the dashboard for members. */
export default function HomeContent() {
  const { address, chainId, isConnected } = useConnection();
  if (!isConnected || !address) return <Landing />;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:py-10">
      <MemberHome address={address} onRightChain={chainId === defaultChain.id} />
    </main>
  );
}

function MemberHome({ address, onRightChain }: { address: Address; onRightChain: boolean }) {
  const member = useMember(address);

  if (!trustCircleAddress) return <Notice>Trust Circle is not deployed on {defaultChain.name} yet.</Notice>;
  if (!onRightChain) return <Notice tone="warning">Switch your wallet to {defaultChain.name} to continue.</Notice>;
  if (member.isError) return <Notice tone="warning">Could not read the contract. Check your connection and reload.</Notice>;
  if (!member.data) return <p className="text-muted">Loading…</p>;

  if (!member.data.isHuman) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <Card title="This wallet is not registered yet" glow>
          <p className="text-sm leading-relaxed text-muted">
            Every member is a verified human. Registering takes one World ID check and one transaction.
          </p>
          <Link href="/register" className={`${buttonClass("primary")} self-start`}>
            Register with World ID
            <ChevronRight />
          </Link>
        </Card>
      </div>
    );
  }

  return <Dashboard account={address} member={member.data} />;
}
