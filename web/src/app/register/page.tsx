import Link from "next/link";
import RegisterFlow from "./RegisterFlow";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-foreground/60 hover:underline">
          ← Trust Circle
        </Link>
        <h1 className="text-2xl font-semibold">Register as a human</h1>
      </header>
      <RegisterFlow />
    </main>
  );
}
