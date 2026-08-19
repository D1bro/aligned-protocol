import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

// Server-side client for Server Components, Server Actions and Route
// Handlers. Reads/writes the session via cookies. Still just the anon key —
// RLS is what actually enforces access, here and in the browser client alike.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component that can't set cookies (e.g. a
          // page render, not a Server Action). Safe to ignore as long as
          // middleware.ts is refreshing the session on every request.
        }
      },
    },
  });
}
