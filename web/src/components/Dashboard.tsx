"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import LoanSection from "@/components/LoanSection";
import TxStatus from "@/components/TxStatus";
import { Button, Card, Notice, ProfileLink, Stat } from "@/components/ui";
import { useBacked } from "@/lib/backed";
import { displayBalance, displayUsdc } from "@/lib/format";
import { TIER_NAMES, vouchLabel, type Vouch } from "@/lib/loan";
import { useChainNow, useProtocol, useVouches, type Member, type VouchPair } from "@/lib/useTrustCircle";
import { useTx } from "@/lib/useTx";

/** Home for a connected, registered member: their loan, who backs them, whom they back, and what they can claim. */
export default function Dashboard({ account, member }: { account: Address; member: Member }) {
  const protocol = useProtocol();
  const now = useChainNow();
  const backers = useVouches(member.vouchers.map((voucher) => ({ voucher, borrower: account })));

  if (protocol.isError) return <Notice tone="warning">Could not read the contract. Check your connection and reload.</Notice>;
  if (!protocol.data) return <p className="text-foreground/60">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <Summary account={account} member={member} />
      {protocol.data.paused && (
        <Notice tone="warning">New vouches and loans are paused. Repaying, withdrawing and claiming still work.</Notice>
      )}
      <LoanSection account={account} member={member} protocol={protocol.data} backers={backers.data ?? []} now={now} />
      {!member.hasDefaulted && <Backers account={account} backers={backers.data ?? []} now={now} />}
      <Backed account={account} now={now} />
      <Claim account={account} claimable={member.claimable} />
    </div>
  );
}

function Summary({ account, member }: { account: Address; member: Member }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${account}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the profile link above still leads to the page to share.
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">
          <span aria-hidden className="text-green-700 dark:text-green-400">✓ </span>
          Verified human
        </p>
        <ProfileLink address={account} />
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Reputation">{member.reputation.toString()}</Stat>
        <Stat label="Tier">{TIER_NAMES[member.tier]}</Stat>
        <Stat label="USDC">{displayBalance(member.balance)}</Stat>
      </dl>
      {!member.hasDefaulted && (
        <Button variant="secondary" className="self-start" onClick={copyLink}>
          {copied ? "Link copied" : "Copy your profile link"}
        </Button>
      )}
    </Card>
  );
}

/** Members who vouch for this account. An unwanted vouch can be declined while none of it is lent out. */
function Backers({ account, backers, now }: { account: Address; backers: readonly (Vouch & VouchPair)[]; now: number | undefined }) {
  const tx = useTx(account);
  const total = backers.reduce((sum, v) => sum + v.amount, 0n);

  return (
    <Card title="Vouching for you" aside={backers.length > 0 && `${displayUsdc(total)} USDC staked`}>
      {backers.length === 0 ? (
        <p className="text-sm text-foreground/70">Nobody yet. Friends vouch for you from your profile page.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {backers.map((v) => (
            <li key={v.voucher} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <ProfileLink address={v.voucher} />
              <span className="text-sm tabular-nums">
                {displayUsdc(v.amount)} USDC
                <span className="text-foreground/60"> · {vouchLabel(v, now)}</span>
              </span>
              {v.locked === 0n && (
                <Button
                  variant="quiet"
                  disabled={tx.busy}
                  onClick={() => tx.run((actions) => [{ label: "Decline vouch", send: () => actions.rejectVouch(v.voucher) }])}
                >
                  Decline
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <TxStatus state={tx.state} done="Vouch declined; the stake goes back to its owner." />
    </Card>
  );
}

/** Members this account vouches for, and a way to reach anyone else's profile. */
function Backed({ account, now }: { account: Address; now: number | undefined }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const remembered = useBacked(account);
  const vouches = useVouches(remembered.map((borrower) => ({ voucher: account, borrower })));
  const open = (vouches.data ?? []).filter((v) => v.amount > 0n);
  const target = input.trim();

  return (
    <Card title="You vouch for">
      {open.length > 0 && (
        <ul className="flex flex-col gap-3">
          {open.map((v) => (
            <li key={v.borrower} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <ProfileLink address={v.borrower} />
              <span className="text-sm tabular-nums">
                {displayUsdc(v.amount)} USDC
                <span className="text-foreground/60"> · {vouchLabel(v, now)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (isAddress(target, { strict: false })) router.push(`/u/${getAddress(target)}`);
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm text-foreground/60">Vouch for a friend: paste their wallet address</span>
          <input
            className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-foreground"
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        {target !== "" && !isAddress(target, { strict: false }) && <p className="text-sm text-red-600">That is not a wallet address.</p>}
        <Button variant="secondary" type="submit" className="self-start" disabled={!isAddress(target, { strict: false })}>
          Open their profile
        </Button>
      </form>
    </Card>
  );
}

/** Interest earned and stakes returned by the contract wait here until claimed. */
function Claim({ account, claimable }: { account: Address; claimable: bigint }) {
  const tx = useTx(account);
  if (claimable === 0n && tx.state.status === "idle") return null;

  return (
    <Card title="Ready to claim">
      <p className="text-3xl font-semibold tabular-nums">{displayUsdc(claimable)} USDC</p>
      <p className="text-sm text-foreground/60">Interest from loans you backed, and any stake that was returned to you.</p>
      <Button
        className="self-start"
        disabled={tx.busy || claimable === 0n}
        onClick={() => tx.run((actions) => [{ label: "Claim", send: actions.claim }])}
      >
        Claim
      </Button>
      <TxStatus state={tx.state} done="Claimed to your wallet." />
    </Card>
  );
}
