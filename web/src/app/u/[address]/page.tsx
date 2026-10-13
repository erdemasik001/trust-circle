import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAddress, isAddress } from "viem";
import { shortAddress } from "@/lib/format";
import Profile from "./Profile";

export async function generateMetadata({ params }: PageProps<"/u/[address]">): Promise<Metadata> {
  const { address } = await params;
  if (!isAddress(address, { strict: false })) return {};
  return { title: `${shortAddress(getAddress(address))} on Trust Circle` };
}

export default async function ProfilePage({ params }: PageProps<"/u/[address]">) {
  const { address } = await params;
  if (!isAddress(address, { strict: false })) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:py-10">
      <Profile address={getAddress(address)} />
    </main>
  );
}
