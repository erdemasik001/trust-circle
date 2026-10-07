import type { Address } from "viem";

/**
 * Shared between the browser and the attestation API: what the World ID proof is bound to,
 * and the EIP-712 attestation that `TrustCircle.register` checks.
 */

export type WorldCredential = "selfieCheck" | "deviceLegacy" | "proofOfHuman";

/** `responses[].identifier` values each credential can return (proofOfHuman falls back to legacy Orb). */
export const CREDENTIAL_IDENTIFIERS: Record<WorldCredential, readonly string[]> = {
  selfieCheck: ["selfie"],
  deviceLegacy: ["device"],
  proofOfHuman: ["proof_of_human", "orb"],
};

/** IDKit's `allow_legacy_proofs` for each credential: Selfie Check is 4.0-only. */
export const ALLOW_LEGACY_PROOFS: Record<WorldCredential, boolean> = {
  selfieCheck: false,
  deviceLegacy: true,
  proofOfHuman: true,
};

export function isWorldCredential(value: string | undefined): value is WorldCredential {
  return value === "selfieCheck" || value === "deviceLegacy" || value === "proofOfHuman";
}

/**
 * The World ID signal is the wallet that will call `register`. Lowercased so the browser and the
 * backend always hash the same string.
 */
export function signalFor(wallet: Address): string {
  return wallet.toLowerCase();
}

export const ATTESTATION_TYPES = {
  Attestation: [
    { name: "wallet", type: "address" },
    { name: "nullifierHash", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export function attestationDomain(chainId: number, trustCircle: Address) {
  return { name: "TrustCircle", version: "1", chainId, verifyingContract: trustCircle } as const;
}

/** What the attestation API returns: the arguments of `TrustCircle.register`, as decimal strings. */
export type Attestation = {
  nullifierHash: string;
  deadline: string;
  signature: `0x${string}`;
};
