"use client";

import Link from "next/link";
import { useConnection } from "wagmi";
import Dashboard from "@/components/Dashboard";
import { Notice } from "@/components/ui";
import { defaultChain } from "@/lib/chains";
import { trustCircleAddress } from "@/lib/trustCircle";
import { useMember } from "@/lib/useTrustCircle";

const steps = [
  ["Prove you are human", "Register once with World ID. One person, one account."],
  ["Friends vouch for you", "They stake USDC in the contract's escrow. Their stake sets how much you can borrow."],
  ["Borrow and repay", "Repaying on time raises your reputation, and your vouchers earn most of the interest."],
];

/** The landing page for visitors, the register prompt for new wallets, the dashboard for members. */
export default function HomeContent() {
  const { address, chainId, isConnected } = useConnection();
  const member = useMember(address);

  if (!isConnected || !address) return <Landing />;
  if (!trustCircleAddress) return <Notice>Trust Circle is not deployed on {defaultChain.name} yet.</Notice>;
  if (chainId !== defaultChain.id) return <Notice>Switch your wallet to {defaultChain.name} to continue.</Notice>;
  if (member.isError) return <Notice tone="warning">Could not read the contract. Check your connection and reload.</Notice>;
  if (!member.data) return <p className="text-foreground/60">Loading…</p>;

  if (!member.data.isHuman) {
    return (
      <section className="flex flex-col items-start gap-4">
        <p className="text-lg">This wallet is not registered yet.</p>
        <p className="text-foreground/70">Every member is a verified human. Registering takes one World ID check and one transaction.</p>
        <Link href="/register" className="rounded-full bg-foreground px-5 py-2 text-background">
          Register with World ID
        </Link>
      </section>
    );
  }

  return <Dashboard account={address} member={member.data} />;
}

function Landing() {
  return (
    <>
      <section className="flex flex-col gap-3">
        <p className="text-2xl font-semibold leading-snug">Micro-loans in USDC on Arc, backed by people who trust you.</p>
        <p className="text-foreground/70">
          No collateral and no credit score. Friends vouch for you by staking USDC; you borrow against their trust and
          build a reputation of your own.
        </p>
      </section>
      <ol className="flex flex-col gap-4">
        {steps.map(([title, text], i) => (
          <li key={title} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground/30 text-sm">
              {i + 1}
            </span>
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-sm text-foreground/70">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link href="/register" className="self-start rounded-full bg-foreground px-5 py-2 text-background">
        Get started: register with World ID
      </Link>
    </>
  );
}
