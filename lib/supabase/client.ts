"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Browser-side client. Uses the anon key only — every table it touches is
// protected by the RLS policies in supabase/migrations/0001_init.sql, so this
// key being public is safe by design, not by obscurity.
export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
