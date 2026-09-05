// Simpele in-memory rate-limiter voor de gevoeligste endpoints (registreren, inloggen,
// vergelijken). Geen externe dienst (Redis e.d.) nodig — voor een single-instance
// deployment is een module-level Map voldoende. Bij meerdere instanties (bv. serverless
// met veel concurrency) telt elke instantie apart; vervang dit dan door een gedeelde store.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// buckets die al verlopen zijn opruimen, anders groeit de Map ongelimiteerd
setInterval(
  () => {
    const now = Date.now();
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  },
  5 * 60_000,
).unref();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
