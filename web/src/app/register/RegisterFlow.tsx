"use client";

import { IDKitRequestWidget, type IDKitResult, type RpContext } from "@worldcoin/idkit";
import { useState } from "react";
import type { Hash } from "viem";
import { useConnection, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import ConnectButton from "@/components/ConnectButton";
import TxLink from "@/components/TxLink";
import type { Attestation } from "@/lib/attestation";
import { defaultChain } from "@/lib/chains";
import { trustCircleAbi, trustCircleAddress } from "@/lib/trustCircle";
import { allowLegacyProofs, presetFor, world, worldConfigured } from "@/lib/world";

type Step = "idle" | "signing" | "proving" | "submitting";

async function fetchRpContext(): Promise<RpContext> {
  const res = await fetch("/api/rp-signature", { method: "POST" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Could not start World ID verification.");
  return {
    rp_id: world.rpId,
    nonce: body.nonce,
    created_at: body.created_at,
    expires_at: body.expires_at,
    signature: body.sig,
  };
}

export default function RegisterFlow() {
  const { address, chainId, isConnected } = useConnection();
  const onRightChain = chainId === defaultChain.id;

  const isHuman = useReadContract({
    address: trustCircleAddress,
    abi: trustCircleAbi,
    functionName: "isHuman",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && trustCircleAddress) },
  });

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [hash, setHash] = useState<Hash | null>(null);

  const { writeContractAsync } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: hash ?? undefined, query: { enabled: Boolean(hash) } });

  if (!trustCircleAddress) return <Notice>TrustCircle is not deployed on {defaultChain.name} yet.</Notice>;
  if (!worldConfigured) return <Notice>World ID is not configured (NEXT_PUBLIC_WORLD_RP_ID).</Notice>;

  if (!isConnected || !address || !onRightChain) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p>Connect the wallet you want to register. One World ID can register one wallet, once.</p>
        <ConnectButton />
      </div>
    );
  }

  if (receipt.isSuccess || isHuman.data) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-lg font-medium">You are registered as a verified human.</p>
        <p className="text-foreground/70">Friends can now vouch for you, and you can vouch for them.</p>
        {hash && <TxLink hash={hash}>View registration transaction</TxLink>}
      </div>
    );
  }

  async function start() {
    setError(null);
    setStep("signing");
    try {
      setRpContext(await fetchRpContext());
      setStep("proving");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("idle");
    }
  }

  /** Runs inside the World ID widget: a thrown error is shown there and the user can retry. */
  async function verifyWithBackend(result: IDKitResult) {
    const res = await fetch("/api/attest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: address, idkitResponse: result }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Verification failed.");
    setAttestation(body as Attestation);
  }

  async function submit(att: Attestation) {
    setStep("submitting");
    try {
      const txHash = await writeContractAsync({
        address: trustCircleAddress!,
        abi: trustCircleAbi,
        functionName: "register",
        args: [BigInt(att.nullifierHash), BigInt(att.deadline), att.signature],
      });
      setHash(txHash);
    } catch (e) {
      setError(e instanceof Error ? e.message.split("\n")[0] : String(e));
      setStep("idle");
    }
  }

  const busy = step !== "idle" || receipt.isLoading;

  return (
    <div className="flex flex-col items-start gap-4">
      <ol className="list-decimal space-y-1 pl-5 text-foreground/80">
        <li>Verify with World ID in World App (Selfie Check, no Orb needed).</li>
        <li>Confirm one transaction that registers this wallet. The fee is paid in USDC.</li>
      </ol>

      {attestation && !hash ? (
        <button className="rounded-full bg-foreground px-5 py-2 text-background disabled:opacity-50" disabled={busy} onClick={() => submit(attestation)}>
          {step === "submitting" ? "Confirm in your wallet…" : "Register on Arc"}
        </button>
      ) : (
        <button className="rounded-full bg-foreground px-5 py-2 text-background disabled:opacity-50" disabled={busy} onClick={start}>
          {step === "signing" ? "Preparing…" : receipt.isLoading ? "Registering…" : "Verify with World ID"}
        </button>
      )}

      {hash && receipt.isLoading && (
        <p className="text-sm">
          Waiting for confirmation: <TxLink hash={hash} />
        </p>
      )}
      {receipt.isError && <p className="text-sm text-red-600">The registration transaction failed.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {rpContext && (
        <IDKitRequestWidget
          open={step === "proving"}
          onOpenChange={(open) => {
            if (!open && step === "proving") setStep("idle");
          }}
          app_id={world.appId}
          action={world.action}
          rp_context={rpContext}
          allow_legacy_proofs={allowLegacyProofs}
          environment={world.environment}
          preset={presetFor(address)}
          handleVerify={verifyWithBackend}
          onSuccess={() => setStep("idle")}
          onError={(code) => {
            setError(`World ID: ${code}`);
            setStep("idle");
          }}
        />
      )}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-foreground/20 p-4 text-sm">{children}</p>;
}
