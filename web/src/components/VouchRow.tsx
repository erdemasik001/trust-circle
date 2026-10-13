import type { Address } from "viem";
import { Badge, ProfileLink } from "@/components/ui";
import { displayUsdc } from "@/lib/format";
import { vouchLabel, vouchPhase, type Vouch } from "@/lib/loan";

type Props = {
  /** The other party: the voucher in a list of backers, the borrower in a list of stakes. */
  address: Address;
  vouch: Vouch;
  now: number | undefined;
  /** Shown after the address, for example "you". */
  note?: string;
  children?: React.ReactNode;
};

const tones = { active: "accent", activating: "neutral", lent: "warning" } as const;

/** One stake in a list: who, how much, and whether it is waiting, active or lent out. */
export default function VouchRow({ address, vouch, now, note, children }: Props) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-raised px-4 py-3">
      <span className="flex items-center gap-2">
        <ProfileLink address={address} />
        {note && <span className="text-xs text-muted">{note}</span>}
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold tabular-nums">{displayUsdc(vouch.amount)} USDC</span>
        {now !== undefined && <Badge tone={tones[vouchPhase(vouch, now)]}>{vouchLabel(vouch, now)}</Badge>}
        {children}
      </span>
    </li>
  );
}
