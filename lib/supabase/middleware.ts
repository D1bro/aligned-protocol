import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

// /api/cron and /api/reminders check their own secret or token.
const PUBLIC_PATHS = ["/login", "/reset-password", "/api/cron", "/api/reminders"];

// Anyone can start and finish the audit without an account. A real (but
// temporary, nameless) account is created behind the scenes via Supabase's
// anonymous sign-in when they press "Begin my audit" (lib/actions/audit.ts), so the answers still live in the real database under
// the same security rules as everyone else — nothing is faked or stored
// client-side. It only becomes a permanent, findable account if the person
// chooses to save it (see lib/actions/auth.ts's signUp, which converts this
// same account in place rather than starting a second one).
const GUEST_PATHS = ["/audit"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const path = request.nextUrl.pathname;

  // Email confirmation links come back as ?code=… (to the Site URL). Swap the
  // code for a session so the person arrives signed in — before anything
  // below would mint a fresh guest session instead. The exchange only works
  // in the browser that created the account; anywhere else the email is
  // still confirmed, so send them to sign in with a note saying so.
  const code = request.nextUrl.searchParams.get("code");
  if (code && !path.startsWith("/reset-password")) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    const url = request.nextUrl.clone();
    url.search = "";
    url.pathname = error ? "/login" : "/";
    if (error) url.searchParams.set("confirmed", "1");
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  // IMPORTANT: do not remove. Refreshes the auth token if needed — without
  // this, sessions silently expire mid-use.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  if (isPublic) return response;

  const isGuestPath = GUEST_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (isGuestPath) {
    // The welcome page (/audit) needs no session. The temporary guest
    // sign-in is only created when someone presses "Begin my audit" (see
    // beginAudit), so link previews, crawlers and people who just look
    // don't become accounts. Any other audit page without a session goes
    // back to the welcome page.
    if (!user && path !== "/audit") {
      const url = request.nextUrl.clone();
      url.pathname = "/audit";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Every other page needs a real, permanent account — not just any session.
  // A guest mid-audit who wanders to, say, the dashboard gets sent to sign
  // in/up rather than seeing a half-built page for an account that isn't
  // really theirs yet.
  if (!user || user.is_anonymous) {
    const url = request.nextUrl.clone();
    // The plain homepage is the front door for anyone without a real
    // account yet — send them straight into the audit (the actual point of
    // entry for a new visitor) instead of a sign-in form they have no use
    // for. Every other protected page still sends them to sign in, since by
    // then they're looking for something specific that only an existing
    // account has.
    url.pathname = path === "/" ? "/audit" : "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
