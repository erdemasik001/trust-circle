import Link from "next/link";
import type { Address } from "viem";
import { Check } from "@/components/icons";
import { shortAddress } from "@/lib/format";

export function Card({
  title,
  aside,
  glow = false,
  children,
}: {
  title?: string;
  aside?: React.ReactNode;
  /** Adds the accent glow in the corner, for the card that matters most on a screen. */
  glow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex flex-col gap-4 rounded-2xl border bg-surface p-5 sm:p-6 ${glow ? "glow-corner" : ""}`}>
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold">{title}</h2>
          {aside && <span className="text-sm text-muted">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

type Variant = "primary" | "secondary" | "quiet";

const buttonStyles: Record<Variant, string> = {
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:brightness-110",
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-semibold transition hover:bg-raised",
  quiet: "text-sm text-muted underline underline-offset-4 transition hover:text-foreground",
};

/** The same look for a `<button>` and for a link that acts as one. */
export const buttonClass = (variant: Variant = "primary") => buttonStyles[variant];

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button type="button" className={`${buttonStyles[variant]} disabled:pointer-events-none disabled:opacity-40 ${className}`} {...props} />;
}

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "warning"; children: React.ReactNode }) {
  const style = tone === "warning" ? "border-warning/40 bg-warning/10" : "bg-raised";
  return <p className={`rounded-xl border ${style} p-4 text-sm leading-relaxed`}>{children}</p>;
}

export function Badge({ tone = "accent", children }: { tone?: "accent" | "neutral" | "warning"; children: React.ReactNode }) {
  const style = { accent: "bg-accent/15 text-accent", neutral: "border text-muted", warning: "bg-warning/15 text-warning" }[tone];
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${style}`}>{children}</span>;
}

export function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

/** A label and its value on one line, for quotes and breakdowns. */
export function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold tabular-nums">{children}</span>
    </div>
  );
}

export function Verified() {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Check className="h-3 w-3" />
      </span>
      Verified human
    </p>
  );
}

export function ProfileLink({ address }: { address: Address }) {
  return (
    <Link href={`/u/${address}`} className="font-mono text-sm underline decoration-border underline-offset-4 transition hover:decoration-accent">
      {shortAddress(address)}
    </Link>
  );
}
