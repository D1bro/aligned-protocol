import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { linkType, safeNext } from "@/lib/auth-links";

// Every sign-in email (confirm, invite, reset, sign-in link, email change)
// links here with a one-time token. Checking it signs the person in on
// whichever device they open it on, then sends them on to `next`.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = linkType(params.get("type"));
  const next = safeNext(params.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.nextUrl.origin));
  }

  // Used already, expired, or cut short when copied.
  const url = new URL("/login", request.nextUrl.origin);
  url.searchParams.set("link", "expired");
  return NextResponse.redirect(url);
}
