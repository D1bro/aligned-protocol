"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/actions/admin";
import { withBillingRecords } from "@/lib/billing-records";
import { emailMatches, removalBlock, REMOVAL_BLOCK_TEXT, type RemovalBlock } from "@/lib/client-removal";

// Admin: permanently remove a client with an account — their sign-in and
// everything they've done. Never staff, never yourself, never anyone with a
// billing record, and only once their email has been typed to confirm.

type Result = { ok: true; message: string } | { ok: false; message: string };

async function check(admin: ReturnType<typeof createAdminClient>, clientId: string, viewerId: string) {
  const { data: person, error } = await admin.from("profiles").select("id, role, email").eq("id", clientId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!person) return { person: null, block: null };
  const billing = await withBillingRecords(admin, [clientId]);
  return { person, block: removalBlock(person, viewerId, billing.has(clientId)) };
}

// Whether the Settings tab should offer the button, and if not, why.
export async function getRemovalCheck(clientId: string): Promise<{ block: RemovalBlock | null; reason: string | null } | null> {
  const me = await requireAdmin();
  try {
    const { person, block } = await check(createAdminClient(), clientId, me.id);
    if (!person) return null;
    return { block, reason: block ? REMOVAL_BLOCK_TEXT[block] : null };
  } catch {
    return null;
  }
}

export async function removeClient(clientId: string, typedEmail: string): Promise<Result> {
  const me = await requireAdmin();
  if (typeof clientId !== "string" || !/^[0-9a-f-]{36}$/i.test(clientId)) return { ok: false, message: "Unknown client." };
  try {
    const admin = createAdminClient();
    const { person, block } = await check(admin, clientId, me.id);
    if (!person) return { ok: false, message: "This client no longer exists." };
    if (block) return { ok: false, message: REMOVAL_BLOCK_TEXT[block] };
    if (!emailMatches(String(typedEmail ?? ""), person.email)) return { ok: false, message: "That email doesn’t match, so nothing was removed." };
    const { error } = await admin.auth.admin.deleteUser(clientId);
    if (error) return { ok: false, message: `Couldn’t remove them: ${error.message}` };
    revalidatePath("/coach", "layout");
    return { ok: true, message: `Removed ${person.email}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn’t remove them — try again." };
  }
}
