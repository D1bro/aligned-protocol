import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/reset-password"];

// Anyone can start and finish the audit without an account. A real (but
// temporary, nameless) account is created behind the scenes via Supabase's
// anonymous sign-in, so the answers still live in the real database under
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

  // IMPORTANT: do not remove. Refreshes the auth token if needed — without
  // this, sessions silently expire mid-use.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  if (isPublic) return response;

  const isGuestPath = GUEST_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (isGuestPath) {
    if (!user) {
      // First visit to the audit with no session at all — mint a temporary
      // anonymous account so the answers have somewhere real to save. The
      // setAll callback above writes this new session's cookies onto
      // `response` automatically, same as it does for normal token refresh.
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }
    }
    // A session already exists (anonymous or real) — let them through either way.
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
