import { signRequest } from "@worldcoin/idkit-core/signing";
import { rpSigningKey, worldConfig } from "@/lib/server/config";
import { clientIp, createRateLimiter } from "@/lib/server/rateLimit";

const allow = createRateLimiter(20, 60_000);

/**
 * Signs a World ID proof request (the `rp_context` IDKit needs) so World ID knows it comes from this app.
 * The action is fixed server-side: callers cannot get signatures for other actions.
 */
export async function POST(request: Request): Promise<Response> {
  if (!allow(clientIp(request))) {
    return Response.json({ error: "Too many requests, try again in a minute." }, { status: 429 });
  }
  const { action } = worldConfig();
  const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex: rpSigningKey(), action });
  return Response.json({ sig, nonce, created_at: createdAt, expires_at: expiresAt });
}
