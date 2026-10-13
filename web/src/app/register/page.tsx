import RegisterFlow from "./RegisterFlow";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10 sm:py-14">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold">Register as a human</h1>
        <p className="text-muted">One World ID registers one wallet, once.</p>
      </div>
      <section className="glow-corner rounded-2xl border bg-surface p-5 sm:p-6">
        <RegisterFlow />
      </section>
    </main>
  );
}
