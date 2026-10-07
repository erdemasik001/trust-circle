import "server-only";

import { createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { attestationDomain, ATTESTATION_TYPES, isWorldCredential } from "../attestation";
import { defaultChain } from "../chains";
import { deployments } from "../contracts";
import type { AttestConfig, AttestDeps } from "./verifyAndAttest";

/** Reads a required env var and fails loudly, without ever echoing secret values. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

const trustCircleAbi = [
  {
    type: "function",
    name: "usedNullifier",
    stateMutability: "view",
    inputs: [{ name: "nullifierHash", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "isHuman",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export function worldConfig(): AttestConfig {
  const environment = required("NEXT_PUBLIC_WORLD_ENVIRONMENT");
  if (environment !== "production" && environment !== "staging") {
    throw new Error("NEXT_PUBLIC_WORLD_ENVIRONMENT must be production or staging");
  }
  const credential = required("NEXT_PUBLIC_WORLD_CREDENTIAL");
  if (!isWorldCredential(credential)) {
    throw new Error("NEXT_PUBLIC_WORLD_CREDENTIAL must be selfieCheck, deviceLegacy or proofOfHuman");
  }
  return {
    rpId: required("NEXT_PUBLIC_WORLD_RP_ID"),
    action: required("NEXT_PUBLIC_WORLD_ACTION"),
    environment,
    credential,
  };
}

export function rpSigningKey(): string {
  return required("RP_SIGNING_KEY");
}

export function attestDeps(): AttestDeps {
  const trustCircle = deployments[defaultChain.id].trustCircle;
  if (!trustCircle) throw new Error(`No TrustCircle deployment for chain ${defaultChain.id}`);

  const client = createPublicClient({ chain: defaultChain, transport: http() });
  const attester = privateKeyToAccount(required("ATTESTER_PRIVATE_KEY") as Hex);
  const domain = attestationDomain(defaultChain.id, trustCircle);

  return {
    async verifyProof(rpId, body) {
      const res = await fetch(`https://developer.world.org/api/v4/verify/${encodeURIComponent(rpId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return { ok: res.ok, json: await res.json().catch(() => null) };
    },
    isNullifierUsed: (nullifier) =>
      client.readContract({ address: trustCircle, abi: trustCircleAbi, functionName: "usedNullifier", args: [nullifier] }),
    isRegistered: (wallet) =>
      client.readContract({ address: trustCircle, abi: trustCircleAbi, functionName: "isHuman", args: [wallet] }),
    signAttestation: (message) =>
      attester.signTypedData({ domain, types: ATTESTATION_TYPES, primaryType: "Attestation", message }),
    now: () => Math.floor(Date.now() / 1000),
  };
}
