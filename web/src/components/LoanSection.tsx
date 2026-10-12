"use client";

import { useState } from "react";
import type { Address } from "viem";
import AmountInput from "@/components/AmountInput";
import TxStatus from "@/components/TxStatus";
import { Button, Card, Line, Notice } from "@/components/ui";
import { displayBalance, displayUsdc, formatDate, formatDuration, tryParseUsdc } from "@/lib/format";
import { LoanStatus, TIER_NAMES, loanPhase, quoteBorrow, vouchPhase, type Vouch } from "@/lib/loan";
import type { Member, Protocol } from "@/lib/useTrustCircle";
import { useTx, withUsdcApproval } from "@/lib/useTx";

type Props = {
  account: Address;
  member: Member;
  protocol: Protocol;
  /** The vouches behind this member, to explain a limit of zero. */
  backers: readonly Vouch[];
  now: number | undefined;
};

const percent = (bps: bigint) => `${Number(bps) / 100}%`;

/** The member's open loan with a repay button, or the form to take a new one. */
export default function LoanSection({ account, member, protocol, backers, now }: Props) {
  const tx = useTx(account);
  const [input, setInput] = useState("");
  const [lastAction, setLastAction] = useState<"borrow" | "repay">("borrow");
  const status = <TxStatus state={tx.state} done={lastAction === "borrow" ? "The loan is in your wallet." : "Loan repaid."} />;

  const { loan } = member;
  const terms = protocol.tiers[member.tier];

  if (loan.status === LoanStatus.Active) {
    const owed = loan.principal + loan.interest;
    const missing = owed - member.balance;
    const phase = loanPhase(loan, now ?? 0, protocol.gracePeriod);

    async function repay() {
      setLastAction("repay");
      await tx.run((actions) => withUsdcApproval(actions, owed, { label: "Repay", send: actions.repay }));
    }

    return (
      <Card title="Your loan" aside={phase === "active" ? `Due ${formatDate(loan.dueAt)}` : "Overdue"}>
        <div>
          <p className="text-3xl font-semibold tabular-nums">{displayUsdc(owed)} USDC</p>
          <p className="text-sm text-foreground/60">
            to repay: {displayUsdc(loan.principal)} borrowed + {displayUsdc(loan.interest)} interest
          </p>
        </div>
        {phase === "active" && now !== undefined && (
          <p className="text-sm">Repay within {formatDuration(loan.dueAt - now)} to raise your reputation.</p>
        )}
        {phase === "overdue" && (
          <Notice tone="warning">
            This loan was due on {formatDate(loan.dueAt)}. You can still repay it, but from{" "}
            {formatDate(loan.dueAt + protocol.gracePeriod)} it can be closed as a default: your vouchers lose what they
            lent you and your reputation drops to zero.
          </Notice>
        )}
        {phase === "liquidatable" && (
          <Notice tone="warning">
            The grace period is over. Anyone can now close this loan as a default, which costs your vouchers what they
            lent you and resets your reputation. Repay now to prevent that.
          </Notice>
        )}
        {missing > 0n && (
          <Notice tone="warning">
            Your balance is {displayBalance(member.balance)} USDC. Add at least {displayUsdc(missing)} USDC, plus a little
            for the network fee, to repay.
          </Notice>
        )}
        <Button className="self-start" disabled={tx.busy || missing > 0n} onClick={repay}>
          Repay {displayUsdc(owed)} USDC
        </Button>
        {status}
      </Card>
    );
  }

  const limit = member.availableLimit;
  const amount = tryParseUsdc(input);
  const quote = amount ? quoteBorrow(amount, terms.interestBps, protocol.insuranceFeeBps) : null;
  const problem =
    amount === null || amount === 0n
      ? null
      : amount < protocol.minBorrow
        ? `The smallest loan is ${displayUsdc(protocol.minBorrow)} USDC.`
        : amount > limit
          ? `Your limit is ${displayUsdc(limit)} USDC.`
          : null;

  async function borrow() {
    if (!amount) return;
    setLastAction("borrow");
    const done = await tx.run((actions) => [{ label: "Borrow", send: () => actions.borrow(amount) }]);
    if (done) setInput("");
  }

  return (
    <Card title="Borrow" aside={`${TIER_NAMES[member.tier]} terms: ${percent(terms.interestBps)} interest`}>
      {member.hasDefaulted ? (
        <p className="text-sm">A loan from this wallet was closed as a default, so it can no longer borrow.</p>
      ) : limit === 0n ? (
        <p className="text-sm">{whyNoLimit(backers, Number(terms.minVouchers), now)}</p>
      ) : (
        <>
          <p className="text-sm">
            You can borrow up to <span className="font-semibold tabular-nums">{displayUsdc(limit)} USDC</span>, backed by
            your vouchers&apos; stakes.
          </p>
          <AmountInput label="Amount" value={input} onChange={setInput} max={limit} disabled={tx.busy || protocol.paused} />
          {quote && !problem && (
            <div className="flex flex-col gap-1">
              <Line label={`Insurance fee (${percent(protocol.insuranceFeeBps)})`}>{displayUsdc(quote.fee)} USDC</Line>
              <Line label="You receive">{displayUsdc(quote.received)} USDC</Line>
              <Line label={`Interest (${percent(terms.interestBps)})`}>{displayUsdc(quote.interest)} USDC</Line>
              <Line label="You repay">
                {displayUsdc(quote.owed)} USDC
                {now !== undefined && ` by ${formatDate(now + protocol.loanDuration)}`}
              </Line>
            </div>
          )}
          {problem && <p className="text-sm text-red-600">{problem}</p>}
          <Button className="self-start" disabled={tx.busy || protocol.paused || !amount || Boolean(problem)} onClick={borrow}>
            Borrow
          </Button>
        </>
      )}
      {status}
    </Card>
  );
}

function whyNoLimit(backers: readonly Vouch[], minVouchers: number, now: number | undefined): string {
  if (backers.length === 0) {
    return "Nobody is vouching for you yet. Send your profile link to a friend who trusts you: their stake sets how much you can borrow.";
  }
  if (now === undefined) return "You cannot borrow right now.";

  const waiting = backers.filter((v) => vouchPhase(v, now) === "activating");
  const active = backers.length - waiting.length;
  if (active >= minVouchers) return "You cannot borrow right now.";

  const need = `You need ${minVouchers} active ${minVouchers === 1 ? "voucher" : "vouchers"} to borrow and have ${active}.`;
  if (waiting.length === 0) return need;
  const soonest = Math.min(...waiting.map((v) => v.activatesAt));
  return `${need} A new vouch counts after a waiting period; your next one becomes active in ${formatDuration(soonest - now)}.`;
}
