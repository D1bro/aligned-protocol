import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/email";

// One-click "stop these reminders" from the email footer.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  let ok = false;
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    const { data } = await createAdminClient()
      .from("profiles")
      .update({ reminders_email: false })
      .eq("email_token", token)
      .select("id");
    ok = !!data?.length;
  }
  const body = ok
    ? "You won’t get check-in reminders any more. You can turn them back on from My profile."
    : "That link didn’t work. You can turn reminders off from My profile.";
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reminders</title><body style="font-family:Arial,sans-serif;background:#100F18;color:#FBF8F2;display:grid;place-items:center;min-height:100vh;margin:0"><div style="max-width:420px;padding:24px;text-align:center"><p style="letter-spacing:3px;font-size:12px;color:#D3A758">ALIGNED PROTOCOL</p><p>${body}</p><p><a href="${SITE_URL}/" style="color:#D3A758">Go to my profile</a></p></div></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
