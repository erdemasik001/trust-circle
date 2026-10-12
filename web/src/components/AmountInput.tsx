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
    <label className="flex flex-col gap-1">
      <span className="text-sm text-foreground/60">{label}</span>
      <span className="flex items-center gap-3 rounded-xl border border-foreground/20 px-3 py-2 focus-within:border-foreground">
        <input
          className="w-full min-w-0 bg-transparent text-lg tabular-nums outline-none disabled:opacity-50"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {max !== undefined && (
          <button type="button" className="text-sm underline underline-offset-4 disabled:opacity-50" disabled={disabled} onClick={() => onChange(formatUsdc(max))}>
            Max
          </button>
        )}
        <span className="text-foreground/60">USDC</span>
      </span>
    </label>
  );
}
