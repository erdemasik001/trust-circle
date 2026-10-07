import { attestDeps, worldConfig } from "@/lib/server/config";
import { clientIp, createRateLimiter } from "@/lib/server/rateLimit";
import { AttestError, verifyAndAttest } from "@/lib/server/verifyAndAttest";

const allow = createRateLimiter(10, 60_000);

/**
 * Verifies a World ID proof bound to `wallet` and returns the attester's signature for
 * `TrustCircle.register(nullifierHash, deadline, signature)`, which the wallet then sends itself.
 */
export async function POST(request: Request): Promise<Response> {
  if (!allow(clientIp(request))) {
    return Response.json({ error: "Too many requests, try again in a minute." }, { status: 429 });
  }

  let body: { wallet?: unknown; idkitResponse?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const attestation = await verifyAndAttest(
      { wallet: body.wallet, idkitResponse: body.idkitResponse },
      worldConfig(),
      attestDeps(),
    );
    return Response.json(attestation);
  } catch (err) {
    if (err instanceof AttestError) {
      return Response.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("attest failed", err instanceof Error ? err.message : "unknown error");
    return Response.json({ error: "Attestation failed, please try again." }, { status: 500 });
  }
}
