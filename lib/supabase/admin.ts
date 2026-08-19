import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env, requireServiceRoleKey } from "@/lib/env";

// SERVICE ROLE — bypasses every RLS policy. `import "server-only"` makes any
// accidental import from a Client Component a build error, not a runtime leak.
//
// Why this exists: the prototype's "add client" flow called supabase.auth.signUp()
// directly from the coach's own browser tab. In the Supabase JS client, signUp()
// replaces whatever session is currently active — so adding a client silently
// signed the coach out and signed them in AS the new client. This admin client
// creates the new user out-of-band, server-side, so the coach's own session is
// never touched. See lib/actions/coach.ts.
export function createAdminClient() {
  return createSupabaseClient(env.supabaseUrl, requireServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
