import Link from "next/link";
import ConnectButton from "@/components/ConnectButton";
import { defaultChain } from "@/lib/chains";
import { addressUrl, trustCircleAddress } from "@/lib/trustCircle";

export function Header() {
  return (
    <header className="flex items-center justify-between gap-3">
      <Link href="/" className="flex items-center gap-2 text-xl font-semibold">
        Trust Circle
        {defaultChain.testnet && (
          <span className="rounded-full border border-foreground/30 px-2 py-0.5 text-xs font-normal text-foreground/70">Testnet</span>
        )}
      </Link>
      <ConnectButton />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto flex flex-col gap-1 pt-8 text-xs text-foreground/60">
      <p>Unaudited beta with small, capped loans. Only stake what you can afford to lose.</p>
      <p className="flex flex-wrap gap-x-4">
        <span>{defaultChain.name}</span>
        {trustCircleAddress && (
          <a className="underline underline-offset-4" href={addressUrl(trustCircleAddress)} target="_blank" rel="noreferrer">
            Contract
          </a>
        )}
        <a className="underline underline-offset-4" href="https://github.com/erdemasik001/trust-circle" target="_blank" rel="noreferrer">
          Source
        </a>
      </p>
    </footer>
  );
}
