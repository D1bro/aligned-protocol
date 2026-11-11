"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions/admin";
import { FILM_SLOTS, linkProblem } from "@/lib/films";

type Result = { ok: true } | { ok: false; message: string };

// Console → Films: the link for one slot. An empty link takes the film off
// the site (the page then shows nothing in its place).
export async function saveFilmLink(slot: string, url: string): Promise<Result> {
  const me = await requireAdmin();
  const def = FILM_SLOTS.find((s) => s.id === slot);
  if (!def) return { ok: false, message: "That isn’t a film slot." };
  const link = url.trim();
  const problem = linkProblem(link, def.kind);
  if (problem) return { ok: false, message: problem };
  const supabase = await createClient();
  const { error } = link
    ? await supabase.from("film_links").upsert({ slot, url: link, updated_at: new Date().toISOString(), updated_by: me.id })
    : await supabase.from("film_links").delete().eq("slot", slot);
  if (error) return { ok: false, message: "Couldn’t save. Has database update 0033 been run?" };
  revalidateTag("film-links");
  revalidatePath("/", "layout");
  return { ok: true };
}
