"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { Copy } from "@/components/icons";
import LoanSection from "@/components/LoanSection";
import TxStatus from "@/components/TxStatus";
import { Button, Card, Line, Notice, ProfileLink, Verified } from "@/components/ui";
import VouchRow from "@/components/VouchRow";
import { useBacked } from "@/lib/backed";
import { displayBalance, displayUsdc } from "@/lib/format";
import { TIER_NAMES, type Vouch } from "@/lib/loan";
import { useChainNow, useProtocol, useVouches, type Member, type VouchPair } from "@/lib/useTrustCircle";
import { useTx } from "@/lib/useTx";

/** Home for a connected, registered member: their loan, who backs them, whom they back, and what they can claim. */
export default function Dashboard({ account, member }: { account: Address; member: Member }) {
  const protocol = useProtocol();
  const now = useChainNow();
  const backers = useVouches(member.vouchers.map((voucher) => ({ voucher, borrower: account })));

  if (protocol.isError) return <Notice tone="warning">Could not read the contract. Check your connection and reload.</Notice>;
  if (!protocol.data) return <p className="text-muted">Loading…</p>;

  return (
    <>
      <h1 className="font-display text-2xl font-bold">Dashboard</h1>
      {protocol.data.paused && (
        <Notice tone="warning">New vouches and loans are paused. Repaying, withdrawing and claiming still work.</Notice>
      )}
      <div className="grid gap-5 lg:grid-cols-3">
        <aside className="flex flex-col gap-5 lg:order-last">
          <Summary account={account} member={member} />
          <Claim account={account} claimable={member.claimable} />
        </aside>
        <div className="flex flex-col gap-5 lg:col-span-2">
          <LoanSection account={account} member={member} protocol={protocol.data} backers={backers.data ?? []} now={now} />
          {!member.hasDefaulted && <Backers account={account} backers={backers.data ?? []} now={now} />}
          <Backed account={account} now={now} />
        </div>
      </div>
    </>
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
        <Verified />
        <ProfileLink address={account} />
      </div>
      <div className="flex flex-col gap-2 rounded-xl bg-raised p-4">
        <Line label="Reputation">{member.reputation.toString()}</Line>
        <Line label="Tier">{TIER_NAMES[member.tier]}</Line>
        <Line label="Balance">{displayBalance(member.balance)} USDC</Line>
      </div>
      {!member.hasDefaulted && (
        <Button variant="secondary" onClick={copyLink}>
          <Copy />
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
        <p className="text-sm text-muted">Nobody yet. Friends vouch for you from your profile page.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {backers.map((v) => (
            <VouchRow key={v.voucher} address={v.voucher} vouch={v} now={now}>
              {v.locked === 0n && (
                <Button
                  variant="quiet"
                  disabled={tx.busy}
                  onClick={() => tx.run((actions) => [{ label: "Decline vouch", send: () => actions.rejectVouch(v.voucher) }])}
                >
                  Decline
                </Button>
              )}
            </VouchRow>
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
  const valid = isAddress(target, { strict: false });

  return (
    <Card title="You vouch for">
      {open.length > 0 && (
        <ul className="flex flex-col gap-2">
          {open.map((v) => (
            <VouchRow key={v.borrower} address={v.borrower} vouch={v} now={now} />
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) router.push(`/u/${getAddress(target)}`);
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Vouch for a friend: paste their wallet address</span>
          <input
            className="rounded-xl border border-transparent bg-raised px-4 py-3 font-mono text-sm outline-none transition placeholder:text-muted/60 focus:border-accent/60"
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        {target !== "" && !valid && <p className="text-sm text-danger">That is not a wallet address.</p>}
        <Button variant="secondary" type="submit" className="self-start" disabled={!valid}>
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
    <Card title="Ready to claim" glow>
      <p className="text-3xl font-bold tabular-nums">
        {displayUsdc(claimable)} <span className="text-base font-semibold text-muted">USDC</span>
      </p>
      <p className="text-sm text-muted">Interest from loans you backed, and any stake that was returned to you.</p>
      <Button disabled={tx.busy || claimable === 0n} onClick={() => tx.run((actions) => [{ label: "Claim", send: actions.claim }])}>
        Claim
      </Button>
      <TxStatus state={tx.state} done="Claimed to your wallet." />
    </Card>
  );
}
