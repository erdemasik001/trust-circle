import { deviceLegacy, proofOfHuman, selfieCheck, type Preset } from "@worldcoin/idkit";
import type { Address } from "viem";
import { ALLOW_LEGACY_PROOFS, isWorldCredential, signalFor, type WorldCredential } from "./attestation";

/** Public World ID settings (NEXT_PUBLIC_*, inlined at build time). Secrets stay in lib/server. */
const credential = process.env.NEXT_PUBLIC_WORLD_CREDENTIAL;

export const world = {
  appId: (process.env.NEXT_PUBLIC_WORLD_APP_ID ?? "") as `app_${string}`,
  rpId: process.env.NEXT_PUBLIC_WORLD_RP_ID ?? "",
  action: process.env.NEXT_PUBLIC_WORLD_ACTION ?? "trustcircle-register",
  environment: (process.env.NEXT_PUBLIC_WORLD_ENVIRONMENT === "staging" ? "staging" : "production") as
    | "production"
    | "staging",
  credential: (isWorldCredential(credential) ? credential : "selfieCheck") as WorldCredential,
};

export const worldConfigured = Boolean(world.appId && world.rpId);

/** The IDKit preset for the configured credential, with the proof bound to `wallet`. */
export function presetFor(wallet: Address): Preset {
  const signal = signalFor(wallet);
  switch (world.credential) {
    case "deviceLegacy":
      return deviceLegacy({ signal });
    case "proofOfHuman":
      return proofOfHuman({ signal });
    default:
      return selfieCheck({ signal });
  }
}

export const allowLegacyProofs = ALLOW_LEGACY_PROOFS[world.credential];
