import ConnectButton from "@/components/ConnectButton";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-16">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trust Circle</h1>
        <ConnectButton />
      </header>
      <section className="flex flex-col gap-3">
        <p className="text-lg">Micro-loans in USDC on Arc, backed by people who trust you.</p>
        <p className="text-foreground/70">
          Every member is a verified human (World ID). Friends vouch for you by staking USDC; their stake
          sets your borrowing limit and earns them most of the interest when you repay.
        </p>
      </section>
      {/* TODO(G5): register, vouch, borrow, repay, profile. */}
    </main>
  );
}
