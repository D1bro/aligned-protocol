import "server-only";
import { headers } from "next/headers";

// The site's address as the current request sees it (localhost while
// developing, the real domain on Vercel), for links in emails and payments.
export async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.the-aligned.com";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
