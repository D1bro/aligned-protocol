import { createHmac, timingSafeEqual } from "node:crypto";

// Check a webhook really came from Stripe (signed with our endpoint secret,
// within five minutes). Returns the parsed event, or null.
export function verifyStripeEvent(rawBody: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000)) {
  if (!header || !secret) return null;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(nowSec - Number(t)) > 300) return null;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const match = sigs.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  if (!match) return null;
  try {
    return JSON.parse(rawBody) as { id: string; type: string; data: { object: Record<string, unknown> } };
  } catch {
    return null;
  }
}
