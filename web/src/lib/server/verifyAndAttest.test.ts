import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { recoverTypedDataAddress, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { attestationDomain, ATTESTATION_TYPES, signalFor } from "../attestation";
import { AttestError, verifyAndAttest, type AttestConfig, type AttestDeps } from "./verifyAndAttest";

const attester = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const trustCircle: Address = "0xefbECEc96fd11c05469B43F5c18975F7Aa571B6F";
const domain = attestationDomain(5042002, trustCircle);
const wallet: Address = "0x97174becF0fB0dF8Bb9d55cAF13cCb403d7F8490";
const other: Address = "0x715aaB67Fc6eA3E8a8994AEAa481cb8F7a40aF1d";
const NULLIFIER = "0x2bf8406809dcefb1486dadc96c0a897db9bab002053054cf64272db512c6fbd8";
const NOW = 1_791_400_000;

const config: AttestConfig = {
  rpId: "rp_test",
  action: "trustcircle-register",
  environment: "production",
  credential: "selfieCheck",
};

function proofFor(signer: Address, overrides: Record<string, unknown> = {}, item: Record<string, unknown> = {}) {
  return {
    protocol_version: "4.0",
    nonce: "0xabc",
    action: "trustcircle-register",
    environment: "production",
    responses: [
      {
        identifier: "selfie",
        signal_hash: hashSignal(signalFor(signer)),
        proof: ["0x1", "0x2", "0x3", "0x4", "0x5"],
        nullifier: NULLIFIER,
        issuer_schema_id: 11,
        expires_at_min: NOW,
        sybil_score: 10,
        ...item,
      },
    ],
    ...overrides,
  };
}

let deps: AttestDeps;
let verifyProof: Mock<AttestDeps["verifyProof"]>;

beforeEach(() => {
  verifyProof = vi.fn<AttestDeps["verifyProof"]>(async () => ({
    ok: true,
    json: { success: true, environment: "production", nullifier: NULLIFIER, results: [] },
  }));
  deps = {
    verifyProof,
    isNullifierUsed: vi.fn(async () => false),
    isRegistered: vi.fn(async () => false),
    signAttestation: (message) =>
      attester.signTypedData({ domain, types: ATTESTATION_TYPES, primaryType: "Attestation", message }),
    now: () => NOW,
  };
});

async function expectAttestError(promise: Promise<unknown>, code: string, status?: number) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AttestError);
  expect((err as AttestError).code).toBe(code);
  if (status) expect((err as AttestError).status).toBe(status);
}

describe("verifyAndAttest", () => {
  it("signs an attestation the contract's attester check accepts", async () => {
    const out = await verifyAndAttest({ wallet, idkitResponse: proofFor(wallet) }, config, deps);

    expect(out.nullifierHash).toBe(BigInt(NULLIFIER).toString());
    expect(out.deadline).toBe(String(NOW + 15 * 60));
    const recovered = await recoverTypedDataAddress({
      domain,
      types: ATTESTATION_TYPES,
      primaryType: "Attestation",
      message: { wallet, nullifierHash: BigInt(out.nullifierHash), deadline: BigInt(out.deadline) },
      signature: out.signature,
    });
    expect(recovered).toBe(attester.address);
  });

  it("forwards the IDKit result unchanged to World's verifier", async () => {
    const proof = proofFor(wallet);
    await verifyAndAttest({ wallet, idkitResponse: proof }, config, deps);
    expect(verifyProof).toHaveBeenCalledWith("rp_test", proof);
  });

  it("accepts a lowercase wallet the same as a checksummed one", async () => {
    const out = await verifyAndAttest({ wallet: wallet.toLowerCase(), idkitResponse: proofFor(wallet) }, config, deps);
    expect(out.signature).toMatch(/^0x/);
  });

  it("rejects a proof bound to a different wallet", async () => {
    await expectAttestError(verifyAndAttest({ wallet, idkitResponse: proofFor(other) }, config, deps), "signal_mismatch");
    expect(verifyProof).not.toHaveBeenCalled();
  });

  it("rejects a proof without a signal", async () => {
    const proof = proofFor(wallet, {}, { signal_hash: "0x0" });
    await expectAttestError(verifyAndAttest({ wallet, idkitResponse: proof }, config, deps), "signal_mismatch");
  });

  it("rejects an invalid wallet", async () => {
    await expectAttestError(verifyAndAttest({ wallet: "0x123", idkitResponse: proofFor(wallet) }, config, deps), "bad_wallet");
  });

  it("rejects a staging proof in production before calling World", async () => {
    const proof = proofFor(wallet, { environment: "staging" });
    await expectAttestError(verifyAndAttest({ wallet, idkitResponse: proof }, config, deps), "wrong_environment");
    expect(verifyProof).not.toHaveBeenCalled();
  });

  it("rejects a proof for another action", async () => {
    const proof = proofFor(wallet, { action: "claim-airdrop" });
    await expectAttestError(verifyAndAttest({ wallet, idkitResponse: proof }, config, deps), "wrong_action");
  });

  it("rejects a credential other than the configured one", async () => {
    const proof = proofFor(wallet, {}, { identifier: "device" });
    await expectAttestError(verifyAndAttest({ wallet, idkitResponse: proof }, config, deps), "wrong_credential");
  });

  it("accepts the legacy Orb fallback when proofOfHuman is configured", async () => {
    const proof = proofFor(wallet, { protocol_version: "3.0" }, { identifier: "orb" });
    const out = await verifyAndAttest({ wallet, idkitResponse: proof }, { ...config, credential: "proofOfHuman" }, deps);
    expect(out.signature).toMatch(/^0x/);
  });

  it("rejects more than one credential response", async () => {
    const proof = proofFor(wallet);
    proof.responses.push({ ...proof.responses[0] });
    await expectAttestError(verifyAndAttest({ wallet, idkitResponse: proof }, config, deps), "bad_proof");
  });

  it("rejects a malformed nullifier", async () => {
    const proof = proofFor(wallet, {}, { nullifier: "12345" });
    await expectAttestError(verifyAndAttest({ wallet, idkitResponse: proof }, config, deps), "bad_proof");
  });

  it("rejects when World's verifier fails", async () => {
    verifyProof.mockResolvedValueOnce({ ok: false, json: { success: false, code: "invalid_proof" } });
    await expectAttestError(verifyAndAttest({ wallet, idkitResponse: proofFor(wallet) }, config, deps), "verification_failed");
  });

  it("rejects when World's verifier answers for another environment", async () => {
    verifyProof.mockResolvedValueOnce({ ok: true, json: { success: true, environment: "staging" } });
    await expectAttestError(verifyAndAttest({ wallet, idkitResponse: proofFor(wallet) }, config, deps), "verification_failed");
  });

  it("rejects when World returns a different nullifier", async () => {
    verifyProof.mockResolvedValueOnce({ ok: true, json: { success: true, environment: "production", nullifier: "0x01" } });
    await expectAttestError(
      verifyAndAttest({ wallet, idkitResponse: proofFor(wallet) }, config, deps),
      "nullifier_mismatch",
      502,
    );
  });

  it("rejects a World ID already registered on-chain", async () => {
    deps.isNullifierUsed = vi.fn(async () => true);
    await expectAttestError(verifyAndAttest({ wallet, idkitResponse: proofFor(wallet) }, config, deps), "already_used", 409);
  });

  it("rejects a wallet already registered on-chain", async () => {
    deps.isRegistered = vi.fn(async () => true);
    await expectAttestError(
      verifyAndAttest({ wallet, idkitResponse: proofFor(wallet) }, config, deps),
      "already_registered",
      409,
    );
  });
});
