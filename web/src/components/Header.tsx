import Link from "next/link";
import ConnectButton from "@/components/ConnectButton";
import { ArrowUpRight, LogoMark } from "@/components/icons";
import { Badge } from "@/components/ui";
import { defaultChain } from "@/lib/chains";
import { addressUrl, trustCircleAddress } from "@/lib/trustCircle";

const SOURCE_URL = "https://github.com/erdemasik001/trust-circle";

function External({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="inline-flex items-center gap-1 transition hover:text-foreground" href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <LogoMark />
      <span className="whitespace-nowrap font-display text-sm font-bold uppercase tracking-wide sm:text-base">Trust Circle</span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-3">
          <Brand />
          {defaultChain.testnet && (
            <span className="hidden sm:inline-flex">
              <Badge tone="neutral">Testnet</Badge>
            </span>
          )}
        </div>
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <Link href="/" className="transition hover:text-foreground">
            Dashboard
          </Link>
          {trustCircleAddress && <External href={addressUrl(trustCircleAddress)}>Contract</External>}
          <External href={SOURCE_URL}>Source</External>
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
          <Brand />
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
            {trustCircleAddress && <External href={addressUrl(trustCircleAddress)}>Contract</External>}
            <External href={SOURCE_URL}>Source</External>
            <External href={`${SOURCE_URL}/blob/main/docs/SECURITY.md`}>Security notes</External>
          </nav>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t pt-6 text-xs text-muted">
          <p>Unaudited beta with small, capped loans. Only stake what you can afford to lose.</p>
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {defaultChain.name}
          </span>
        </div>
      </div>
    </footer>
  );
}
