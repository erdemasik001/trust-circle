import Link from "next/link";
import type { Address } from "viem";
import { shortAddress } from "@/lib/format";

export function Card({ title, aside, children }: { title?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-foreground/15 p-5">
      {title && (
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-medium">{title}</h2>
          {aside && <span className="text-sm text-foreground/60">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" };

const buttonStyles = {
  primary: "rounded-full bg-foreground px-5 py-2 text-background",
  secondary: "rounded-full border px-5 py-2",
  quiet: "text-sm underline underline-offset-4",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button type="button" className={`${buttonStyles[variant]} disabled:opacity-50 ${className}`} {...props} />;
}

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "warning"; children: React.ReactNode }) {
  const border = tone === "warning" ? "border-amber-500/60" : "border-foreground/20";
  return <p className={`rounded-lg border ${border} p-4 text-sm`}>{children}</p>;
}

export function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-sm text-foreground/60">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

/** A label and its value on one line, for quotes and breakdowns. */
export function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className="text-right tabular-nums">{children}</span>
    </div>
  );
}

export function ProfileLink({ address }: { address: Address }) {
  return (
    <Link href={`/u/${address}`} className="font-mono text-sm underline underline-offset-4">
      {shortAddress(address)}
    </Link>
  );
}
