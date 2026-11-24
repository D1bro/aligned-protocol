import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendFollowups } from "@/lib/followups";

// The follow-up emails after the audit (lib/followups.ts). vercel.json calls
// this at 08:21 and 09:21 UTC; only the run that is 9:21am in London sends,
// so the time is right in winter and summer. Vercel calls it with
// "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const result = await sendFollowups(createAdminClient());
  return NextResponse.json(result, { status: "error" in result ? 500 : 200 });
}
