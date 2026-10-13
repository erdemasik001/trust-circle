"use client";

import Link from "next/link";
import { ArrowUpRight, Check, ChevronRight, Coins, Lock, Shield, TrendingUp, UserCheck, Zap } from "@/components/icons";
import { Badge, buttonClass } from "@/components/ui";
import { defaultChain } from "@/lib/chains";
import { displayUsdc, formatDuration, formatUsdc } from "@/lib/format";
import { TIER_NAMES } from "@/lib/loan";
import { useProtocol, type Protocol } from "@/lib/useTrustCircle";

const SOURCE_URL = "https://github.com/erdemasik001/trust-circle";

const features = [
  { icon: Coins, title: "USDC is the gas", text: "On Arc, fees are paid in USDC. Members never need a second token." },
  { icon: UserCheck, title: "One human, one account", text: "Every member registers once with World ID." },
  { icon: Lock, title: "Stakes held in escrow", text: "A voucher's USDC sits in the contract and funds the loan it backs." },
  { icon: TrendingUp, title: "Reputation that grows", text: "Each on-time repayment raises your reputation and unlocks better terms." },
  { icon: Zap, title: "Final in under a second", text: "A loan or a repayment is settled the moment it lands." },
  { icon: Shield, title: "Capped while unaudited", text: "Small loans and a limit on total stakes keep the beta's risk low." },
];

const percent = (bps: bigint) => `${Number(bps) / 100}%`;

/** What a visitor sees before connecting a wallet. Every figure is read from the deployed contract. */
export default function Landing() {
  const protocol = useProtocol().data;

  return (
    <main className="flex flex-col">
      <section className="glow-hero">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 pb-16 pt-16 text-center sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Live on {defaultChain.name}
          </span>
          <h1 className="font-display text-4xl font-extrabold leading-[1.1] sm:text-6xl">Loans backed by people who trust you</h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Micro-loans in USDC on Arc with no collateral and no credit score. Friends vouch for you by staking USDC, their
            stake sets your limit, and every repayment builds a reputation of your own.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/register" className={buttonClass("primary")}>
              Get started
              <ChevronRight />
            </Link>
            <a href="#how" className={buttonClass("secondary")}>
              How it works
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-x-10 gap-y-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: FeatureIcon, title, text }) => (
          <div key={title} className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <FeatureIcon className="h-4.5 w-4.5" />
              </span>
              <h2 className="font-semibold">{title}</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted">{text}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-8">
        <p className="mb-4 text-center text-sm text-muted">On-chain right now</p>
        <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-surface lg:grid-cols-4">
          <Figure label="Staked in escrow" value={protocol && `${displayUsdc(protocol.totalStaked)} USDC`} />
          <Figure label="Lent to date" value={protocol && `${displayUsdc(protocol.totalLent)} USDC`} />
          <Figure label="Largest loan in the beta" value={protocol && `${formatUsdc(protocol.maxBorrowPerUser)} USDC`} />
          <Figure label="Wait before a vouch counts" value={protocol && formatDuration(protocol.activationDelay)} />
        </dl>
      </section>

      <section id="how" className="mx-auto flex w-full max-w-5xl scroll-mt-20 flex-col gap-8 px-4 py-12">
        <SectionTitle title="How it works" text="Three steps from a new wallet to a repaid loan." />
        <div className="grid gap-5 lg:grid-cols-3">
          <Step n={1} title="Prove you are human" text="Register once with World ID. One person, one account.">
            <CheckItem>Selfie Check in World App, no Orb needed</CheckItem>
            <CheckItem>One transaction, with the fee paid in USDC</CheckItem>
          </Step>
          <Step n={2} title="Friends vouch for you" text="They open your profile link and stake USDC for you. Their stake sets how much you can borrow.">
            <CheckItem>The stake stays in the contract&apos;s escrow</CheckItem>
            <CheckItem>It counts after {protocol ? formatDuration(protocol.activationDelay) : "a waiting period"}</CheckItem>
            <CheckItem>Vouchers earn {protocol ? percent(protocol.voucherInterestBps) : "most"} of the interest</CheckItem>
          </Step>
          <Step n={3} title="Borrow and repay" text="Take a loan up to your limit and repay it in one payment.">
            <CheckItem>{protocol ? formatDuration(protocol.loanDuration) : "A fixed term"} to repay, at a flat rate</CheckItem>
            <CheckItem>Repaying on time raises your reputation</CheckItem>
            <CheckItem>If you default, your vouchers&apos; stake covers the loss</CheckItem>
          </Step>
        </div>
      </section>

      <section id="tiers" className="mx-auto flex w-full max-w-5xl scroll-mt-20 flex-col gap-8 px-4 py-12">
        <SectionTitle title="Reputation tiers" text="Terms improve as you repay. These are the contract's own numbers." />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TIER_NAMES.map((name, tier) => (
            <Tier key={name} name={name} tier={tier} protocol={protocol} />
          ))}
        </div>
        {protocol && (
          <p className="text-center text-sm text-muted">
            During the beta every loan is capped at {formatUsdc(protocol.maxBorrowPerUser)} USDC, and members above{" "}
            {TIER_NAMES[protocol.maxTierOpen]} borrow on {TIER_NAMES[protocol.maxTierOpen]} terms.
          </p>
        )}
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4">
        <div className="glow-corner flex flex-col items-start gap-4 rounded-2xl border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-xl font-bold">Start with one friend</h2>
            <p className="text-sm text-muted">Register, send them your profile link, and borrow once their vouch counts.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className={buttonClass("primary")}>
              Register
              <ChevronRight />
            </Link>
            <a href={SOURCE_URL} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
              Read the source
              <ArrowUpRight />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionTitle({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <h2 className="text-3xl font-bold">{title}</h2>
      <p className="text-muted">{text}</p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="-mb-px -mr-px flex flex-col gap-1 border-b border-r p-5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value ?? "—"}</dd>
    </div>
  );
}

function Step({ n, title, text, children }: { n: number; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-surface p-6">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">{n}</span>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm leading-relaxed text-muted">{text}</p>
      </div>
      <ul className="mt-auto flex flex-col gap-2 border-t pt-4 text-sm">{children}</ul>
    </div>
  );
}

function Tier({ name, tier, protocol }: { name: string; tier: number; protocol: Protocol | undefined }) {
  const terms = protocol?.tiers[tier];
  const open = protocol ? tier <= protocol.maxTierOpen : undefined;

  return (
    <div className={`flex flex-col gap-4 rounded-2xl border bg-surface p-6 ${tier === 0 ? "glow-corner" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{name}</h3>
        {open !== undefined && <Badge tone={open ? "accent" : "neutral"}>{open ? "Open in beta" : "Opens later"}</Badge>}
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums">{terms ? percent(terms.interestBps) : "—"}</span>
        <span className="text-sm text-muted">interest per loan</span>
      </p>
      <ul className="flex flex-col gap-2 border-t pt-4 text-sm">
        <CheckItem>Borrow up to {terms ? formatUsdc(terms.maxBorrow) : "—"} USDC</CheckItem>
        <CheckItem>
          {terms ? `${terms.minVouchers} active ${terms.minVouchers === 1n ? "voucher" : "vouchers"}` : "— active vouchers"}
        </CheckItem>
        <CheckItem>From {protocol ? protocol.tierReputation[tier].toString() : "—"} reputation</CheckItem>
      </ul>
    </div>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <Check className="mt-0.5 h-4 w-4 text-accent" />
      <span>{children}</span>
    </li>
  );
}
