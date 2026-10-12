import TxLink from "@/components/TxLink";
import type { TxState } from "@/lib/useTx";

/** Where an action stands: waiting for the wallet, waiting for the chain, done or failed. */
export default function TxStatus({ state, done = "Done." }: { state: TxState; done?: string }) {
  switch (state.status) {
    case "idle":
      return null;
    case "preparing":
      return <p className="text-sm text-foreground/70">Preparing…</p>;
    case "wallet":
      return <p className="text-sm text-foreground/70">Confirm in your wallet: {state.label}</p>;
    case "confirming":
      return (
        <p className="text-sm text-foreground/70">
          Waiting for confirmation: <TxLink hash={state.hash} />
        </p>
      );
    case "success":
      return (
        <p className="text-sm text-green-700 dark:text-green-400">
          {done} <TxLink hash={state.hash}>View transaction</TxLink>
        </p>
      );
    case "error":
      return <p className="text-sm text-red-600">{state.message}</p>;
  }
}
