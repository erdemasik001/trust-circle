import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { CREDENTIAL_IDENTIFIERS, signalFor, type Attestation, type WorldCredential } from "../attestation";

/**
 * Turns a World ID proof into a TrustCircle registration attestation.
 *
 * Pure apart from the injected dependencies, so it can be tested without World's API, a chain or a key.
 * Every check here guards something the contract cannot see: the contract trusts whatever the
 * attester signs, so this is where "one human, one wallet" is actually enforced.
 */

export const ATTESTATION_TTL_SECONDS = 15 * 60;

export type AttestConfig = {
  rpId: string;
  action: string;
  environment: "production" | "staging";
  credential: WorldCredential;
};

export type AttestDeps = {
  /** POSTs the IDKit result to World's verifier and returns the status and JSON body. */
  verifyProof: (rpId: string, body: unknown) => Promise<{ ok: boolean; json: unknown }>;
  isNullifierUsed: (nullifier: bigint) => Promise<boolean>;
  isRegistered: (wallet: Address) => Promise<boolean>;
  signAttestation: (message: { wallet: Address; nullifierHash: bigint; deadline: bigint }) => Promise<Hex>;
  now: () => number; // unix seconds
};

export class AttestError extends Error {
  constructor(
    readonly status: 400 | 409 | 502,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type IdkitResponseItem = {
  identifier?: unknown;
  signal_hash?: unknown;
  nullifier?: unknown;
};

type IdkitResult = {
  protocol_version?: unknown;
  action?: unknown;
  environment?: unknown;
  responses?: unknown;
};

function toBigInt(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{1,64}$/.test(value)) return null;
  return BigInt(value);
}

export async function verifyAndAttest(
  input: { wallet: unknown; idkitResponse: unknown },
  config: AttestConfig,
  deps: AttestDeps,
): Promise<Attestation> {
  if (typeof input.wallet !== "string" || !isAddress(input.wallet)) {
    throw new AttestError(400, "bad_wallet", "A valid wallet address is required.");
  }
  const wallet = getAddress(input.wallet);

  const result = input.idkitResponse as IdkitResult | null;
  if (!result || typeof result !== "object") {
    throw new AttestError(400, "bad_proof", "Missing World ID result.");
  }
  // Reject other environments before calling World: a staging proof must never register on mainnet.
  if (result.environment !== config.environment) {
    throw new AttestError(400, "wrong_environment", `Expected a ${config.environment} World ID proof.`);
  }
  if (result.action !== config.action) {
    throw new AttestError(400, "wrong_action", "The proof was made for a different action.");
  }
  if (!Array.isArray(result.responses) || result.responses.length !== 1) {
    throw new AttestError(400, "bad_proof", "Expected exactly one credential proof.");
  }
  const response = result.responses[0] as IdkitResponseItem;
  if (typeof response.identifier !== "string" || !CREDENTIAL_IDENTIFIERS[config.credential].includes(response.identifier)) {
    throw new AttestError(400, "wrong_credential", "The proof is for a different World ID credential.");
  }

  // World's verifier checks the proof against whatever signal hash it carries; binding that hash to
  // this wallet is our job. Without it a proof could be replayed to register someone else's wallet.
  const signalHash = toBigInt(response.signal_hash);
  if (signalHash === null || signalHash !== BigInt(hashSignal(signalFor(wallet)))) {
    throw new AttestError(400, "signal_mismatch", "The proof is not bound to this wallet.");
  }

  const nullifier = toBigInt(response.nullifier);
  if (nullifier === null) {
    throw new AttestError(400, "bad_proof", "The proof has no valid nullifier.");
  }

  // Forward the IDKit result unchanged, apart from pinning the environment we expect.
  const verification = await deps.verifyProof(config.rpId, { ...result, environment: config.environment });
  const body = verification.json as { success?: unknown; environment?: unknown; nullifier?: unknown } | null;
  if (!verification.ok || body?.success !== true || body.environment !== config.environment) {
    throw new AttestError(400, "verification_failed", "World ID could not verify this proof.");
  }
  if (body.nullifier !== undefined && toBigInt(body.nullifier) !== nullifier) {
    throw new AttestError(502, "nullifier_mismatch", "World ID returned a different nullifier.");
  }

  // The contract would reject these too; checking first gives a clear error instead of a failed tx.
  if (await deps.isNullifierUsed(nullifier)) {
    throw new AttestError(409, "already_used", "This World ID is already registered with another wallet.");
  }
  if (await deps.isRegistered(wallet)) {
    throw new AttestError(409, "already_registered", "This wallet is already registered.");
  }

  const deadline = BigInt(deps.now() + ATTESTATION_TTL_SECONDS);
  const signature = await deps.signAttestation({ wallet, nullifierHash: nullifier, deadline });
  return { nullifierHash: nullifier.toString(), deadline: deadline.toString(), signature };
}
