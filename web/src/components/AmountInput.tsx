import { formatUsdc } from "@/lib/format";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Shows a "Max" shortcut that fills in this amount. */
  max?: bigint;
  disabled?: boolean;
};

export default function AmountInput({ label, value, onChange, max, disabled }: Props) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex items-center gap-3 rounded-xl border border-transparent bg-raised px-4 py-3 transition focus-within:border-accent/60">
        <input
          className="w-full min-w-0 bg-transparent text-xl font-semibold tabular-nums outline-none placeholder:text-muted/60 disabled:opacity-50"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {max !== undefined && (
          <button
            type="button"
            className="rounded-md bg-accent/15 px-2 py-1 text-xs font-semibold text-accent transition hover:bg-accent/25 disabled:opacity-40"
            disabled={disabled}
            onClick={() => onChange(formatUsdc(max))}
          >
            Max
          </button>
        )}
        <span className="text-sm font-semibold text-muted">USDC</span>
      </span>
    </label>
  );
}
