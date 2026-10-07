import type { Hash } from "viem";
import { txUrl } from "@/lib/trustCircle";

export default function TxLink({ hash, children }: { hash: Hash; children?: React.ReactNode }) {
  return (
    <a className="font-mono text-sm underline underline-offset-4" href={txUrl(hash)} target="_blank" rel="noreferrer">
      {children ?? `${hash.slice(0, 10)}…${hash.slice(-6)}`}
    </a>
  );
}
