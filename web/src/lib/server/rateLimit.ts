import "server-only";

/**
 * Fixed-window rate limit per key (client IP). In memory, so it is per serverless instance:
 * a speed bump against scripted abuse, not a hard guarantee.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return function allow(key: string): boolean {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (hits.size > 10_000) hits.clear(); // bound memory
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
