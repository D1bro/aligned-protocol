import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// The links Duane has pasted in Console → Films, by slot. Read without the
// visitor's cookies so public pages stay fast; refreshed when a link is
// saved (revalidateTag("film-links")) and at least every ten minutes.
export const getFilmLinks = unstable_cache(
  async (): Promise<Record<string, string>> => {
    try {
      const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false } });
      const { data, error } = await supabase.from("film_links").select("slot, url");
      if (error || !data) return {};
      return Object.fromEntries(data.map((r) => [r.slot as string, r.url as string]));
    } catch {
      // Before the table exists, or with no connection: no links, nothing shown.
      return {};
    }
  },
  ["film-links"],
  { tags: ["film-links"], revalidate: 600 }
);
