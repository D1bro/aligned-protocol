import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/actions/admin";
import { canBill } from "@/lib/actions/billing";
import { loadBilling, loadCoaching, loadOfferedPackages } from "@/lib/member-view";

// "See as client": what one client sees on their Coaching page and the
// coaching card on My profile, read by their coach or an admin. Loaded
// through the same functions as the member's own pages. Nothing private to
// the client (unshared preparation) or to the coach (notes, transcripts,
// unshared summaries) is included.

const PACKAGE_COLUMNS = "id, name, description, price_pence, sessions, valid_days, available_from, available_until, audience, active, position";

export async function getClientPreview(clientId: string) {
  const me = await requireStaff();
  const supabase = await createClient();
  const { data: client } = await supabase.from("profiles").select("id, full_name, email, coach_id, role").eq("id", clientId).maybeSingle();
  if (!client || (me.role !== "admin" && client.coach_id !== me.id)) redirect("/coach/clients");

  const [coaching, billing, packages, expiries, goals, viewerBills] = await Promise.all([
    loadCoaching(supabase, clientId, { drafts: false }),
    loadBilling(supabase, clientId),
    loadOfferedPackages(supabase, clientId, PACKAGE_COLUMNS),
    supabase.rpc("credit_expiries", { p_client: clientId }),
    supabase.from("goals").select("id, goal_title, status").eq("client_id", clientId).eq("status", "active"),
    canBill(),
  ]);
  const active = (goals.data ?? []) as { id: string; goal_title: string | null }[];

  return {
    client: client as { id: string; full_name: string | null; email: string | null },
    coaching,
    billing,
    packages,
    expiries: (expiries.error ? [] : expiries.data ?? []) as { expires_at: string; quantity: number }[],
    goals: active.map((g) => ({ id: g.id, title: g.goal_title?.trim() || "Your goal" })),
    // Invoices, and packages offered only to selected clients, are visible to billing admins.
    viewerBills,
  };
}
