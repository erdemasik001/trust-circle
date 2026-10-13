"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { useConnection } from "wagmi";
import AmountInput from "@/components/AmountInput";
import ConnectButton from "@/components/ConnectButton";
import { ArrowUpRight, ChevronRight } from "@/components/icons";
import TxStatus from "@/components/TxStatus";
import { Button, Card, Line, Notice, Stat, Verified, buttonClass } from "@/components/ui";
import VouchRow from "@/components/VouchRow";
import { rememberBacked } from "@/lib/backed";
import { defaultChain } from "@/lib/chains";
import { displayBalance, displayUsdc, formatDate, formatDuration, shortAddress, tryParseUsdc } from "@/lib/format";
import { TIER_NAMES, loanPhase, vouchLabel, voucherCap, type Loan, type LoanPhase } from "@/lib/loan";
import { addressUrl, trustCircleAddress } from "@/lib/trustCircle";
import { useChainNow, useMember, useProtocol, useVouches, type Member, type Protocol } from "@/lib/useTrustCircle";
import { useTx, withUsdcApproval } from "@/lib/useTx";

/** A member's public page: who they are on Trust Circle, who backs them, and the place to vouch for them. */
export default function Profile({ address }: { address: Address }) {
  const { address: me, chainId, isConnected } = useConnection();
  const connected = isConnected && chainId === defaultChain.id ? me : undefined;

  const member = useMember(address);
  const viewer = useMember(connected);
  const protocol = useProtocol();
  const now = useChainNow();
  const backers = useVouches((member.data?.vouchers ?? []).map((voucher) => ({ voucher, borrower: address })));

  if (!trustCircleAddress) return <Notice>Trust Circle is not deployed on {defaultChain.name} yet.</Notice>;
  if (member.isError || protocol.isError) {
    return <Notice tone="warning">Could not read the contract. Check your connection and reload.</Notice>;
  }
  if (!member.data || !protocol.data) return <p className="text-muted">Loading…</p>;

  const phase = loanPhase(member.data.loan, now ?? 0, protocol.data.gracePeriod);
  const staked = (backers.data ?? []).reduce((sum, v) => sum + v.amount, 0n);

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="flex flex-col gap-5 lg:col-span-3">
        <Card glow>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h1 className="font-mono text-xl font-semibold">{shortAddress(address)}</h1>
            <a
              className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-foreground"
              href={addressUrl(address)}
              target="_blank"
              rel="noreferrer"
            >
              View on explorer
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
          {member.data.isHuman ? (
            <>
              <Verified />
              <dl className="grid grid-cols-3 gap-3 rounded-xl bg-raised p-4">
                <Stat label="Reputation">{member.data.reputation.toString()}</Stat>
                <Stat label="Tier">{TIER_NAMES[member.data.tier]}</Stat>
                <Stat label="Staked USDC">{displayUsdc(staked)}</Stat>
              </dl>
              <p className="text-sm text-muted">{describeLoan(member.data.loan, phase)}</p>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              This wallet is not registered as a verified human, so it cannot borrow or be vouched for.
            </p>
          )}
        </Card>

        {member.data.isHuman && (backers.data ?? []).length > 0 && (
          <Card title="Vouchers">
            <ul className="flex flex-col gap-2">
              {(backers.data ?? []).map((v) => (
                <VouchRow key={v.voucher} address={v.voucher} vouch={v} now={now} note={v.voucher === connected ? "you" : undefined} />
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-5 lg:col-span-2">
        {phase === "liquidatable" && connected && <CloseLoan me={connected} borrower={address} />}

        {member.data.isHuman && (
          <ViewerPanel address={address} connected={connected} member={member.data} viewer={viewer.data} protocol={protocol.data} now={now} />
        )}
      </div>
    </div>
  );
}

type ViewerPanelProps = {
  address: Address;
  /** The visitor's wallet, when it is connected on the right chain. */
  connected: Address | undefined;
  member: Member;
  viewer: Member | undefined;
  protocol: Protocol;
  now: number | undefined;
};

/** What the visitor can do here: share the page if it is their own, otherwise vouch once connected and registered. */
function ViewerPanel({ address, connected, member, viewer, protocol, now }: ViewerPanelProps) {
  // A default closes the account: its vouches are settled and nobody can add new ones.
  if (member.hasDefaulted) return null;
  if (connected === address) {
    return (
      <Card title="This is your profile">
        <p className="text-sm leading-relaxed text-muted">
          Send this page to friends who trust you. They vouch for you here, and their stake sets how much you can borrow.
        </p>
        <Link href="/" className={`${buttonClass("secondary")} self-start`}>
          Go to your dashboard
          <ChevronRight />
        </Link>
      </Card>
    );
  }
  if (!connected) {
    return (
      <Card title="Vouch for this member">
        <p className="text-sm leading-relaxed text-muted">Connect your wallet on {defaultChain.name} to vouch.</p>
        <div>
          <ConnectButton />
        </div>
      </Card>
    );
  }
  if (!viewer) return null;
  if (!viewer.isHuman) {
    return (
      <Card title="Vouch for this member">
        <p className="text-sm leading-relaxed text-muted">Only verified humans can vouch. Registering takes one World ID check.</p>
        <Link href="/register" className={`${buttonClass("primary")} self-start`}>
          Register with World ID
          <ChevronRight />
        </Link>
      </Card>
    );
  }
  return <VouchPanel me={connected} balance={viewer.balance} borrower={address} target={member} protocol={protocol} now={now} />;
}

function describeLoan(loan: Loan, phase: LoanPhase): string {
  const owed = `${displayUsdc(loan.principal + loan.interest)} USDC`;
  switch (phase) {
    case "none":
      return "No loans yet.";
    case "active":
      return `Open loan: ${owed} to repay by ${formatDate(loan.dueAt)}.`;
    case "overdue":
      return `Open loan: ${owed}, overdue since ${formatDate(loan.dueAt)}.`;
    case "liquidatable":
      return `Open loan: ${owed}, overdue and past the grace period.`;
    case "repaid":
      return "No open loan. The last one was repaid.";
    case "defaulted":
      return "Defaulted on a loan. This wallet can no longer borrow.";
  }
}

type VouchPanelProps = {
  me: Address;
  balance: bigint;
  borrower: Address;
  target: Member;
  protocol: Protocol;
  now: number | undefined;
};

/** The viewer's stake for this member: add to it, or withdraw the part that is not lent out. */
function VouchPanel({ me, balance, borrower, target, protocol, now }: VouchPanelProps) {
  const tx = useTx(me);
  const [input, setInput] = useState("");
  const [lastAction, setLastAction] = useState<"vouch" | "withdraw">("vouch");
  const mine = useVouches([{ voucher: me, borrower }]).data?.[0];

  const hasStake = Boolean(mine && mine.amount > 0n);
  useEffect(() => {
    if (hasStake) rememberBacked(me, borrower);
  }, [hasStake, me, borrower]);

  const amount = tryParseUsdc(input);
  const cap = voucherCap(protocol.tiers[target.tier].maxBorrow, protocol.maxVoucherShareBps);
  const unlocked = mine ? mine.amount - mine.locked : 0n;
  const lent = Boolean(mine && mine.locked > 0n);
  const closed = protocol.paused || lent;
  const problem =
    amount === null || amount === 0n
      ? null
      : amount < protocol.minVouch
        ? `The smallest vouch is ${displayUsdc(protocol.minVouch)} USDC.`
        : amount > balance
          ? `Your balance is ${displayBalance(balance)} USDC.`
          : null;

  async function vouch() {
    if (!amount) return;
    setLastAction("vouch");
    const done = await tx.run((actions) =>
      withUsdcApproval(actions, amount, { label: "Vouch", send: () => actions.vouch(borrower, amount) }),
    );
    if (done) {
      rememberBacked(me, borrower);
      setInput("");
    }
  }

  async function withdraw() {
    setLastAction("withdraw");
    await tx.run((actions) => [{ label: "Withdraw", send: () => actions.withdraw(borrower, unlocked) }]);
  }

  return (
    <Card title={hasStake ? "Your vouch" : "Vouch for this member"} glow>
      {mine && hasStake && (
        <div className="flex flex-col gap-2 rounded-xl bg-raised p-4">
          <Line label="Your stake">{displayUsdc(mine.amount)} USDC</Line>
          <Line label="Status">{vouchLabel(mine, now)}</Line>
          {unlocked > 0n && (
            <Button variant="secondary" className="mt-2" disabled={tx.busy} onClick={withdraw}>
              Withdraw {displayUsdc(unlocked)} USDC
            </Button>
          )}
        </div>
      )}

      {lent ? (
        <p className="text-sm leading-relaxed text-muted">Part of your stake is lent out. You can add to it once the loan is repaid.</p>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted">
            Your USDC stays in the contract&apos;s escrow and backs their loans. If they repay, you earn{" "}
            {Number(protocol.voucherInterestBps) / 100}% of the interest. If they default, you lose the part that was lent.
          </p>
          <AmountInput label={hasStake ? "Add to your stake" : "Stake"} value={input} onChange={setInput} disabled={tx.busy || closed} />
          <p className="text-xs leading-relaxed text-muted">
            {hasStake ? "Adding restarts the waiting period for your whole stake: it" : "Your stake"} counts towards their limit
            after {formatDuration(protocol.activationDelay)}. Up to {displayUsdc(cap)} USDC from one voucher counts.
          </p>
          {problem && <p className="text-sm text-danger">{problem}</p>}
          <Button disabled={tx.busy || closed || !amount || Boolean(problem)} onClick={vouch}>
            {hasStake ? "Add to stake" : "Vouch"}
          </Button>
        </>
      )}
      <TxStatus state={tx.state} done={lastAction === "vouch" ? "Your stake is in escrow." : "Withdrawn to your wallet."} />
    </Card>
  );
}

/** Anyone can close a loan that is past its grace period; its vouchers have the reason to. */
function CloseLoan({ me, borrower }: { me: Address; borrower: Address }) {
  const tx = useTx(me);
  return (
    <Card title="Loan past its grace period">
      <p className="text-sm leading-relaxed text-muted">
        This loan was not repaid in time. Closing it marks the member as defaulted: the lent part of each voucher&apos;s
        stake is lost, and the rest becomes claimable by its voucher.
      </p>
      <Button
        variant="secondary"
        className="self-start"
        disabled={tx.busy}
        onClick={() => tx.run((actions) => [{ label: "Close loan", send: () => actions.liquidate(borrower) }])}
      >
        Close the loan as defaulted
      </Button>
      <TxStatus state={tx.state} done="Loan closed." />
    </Card>
  );
}
