import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { MemberCoaching } from "@/lib/actions/member-coaching";
import type { MyBilling } from "@/lib/actions/billing";
import type { Package } from "@/lib/actions/packages";
import { stripeStatus } from "@/lib/stripe";

// What a member sees of their coaching and billing, loaded for one client.
// Used by the member's own pages and by the console's "See as client"
// preview, so the two can't drift apart. The filters here repeat the
// member's database rules (published summaries, steps meant for them,
// issued invoices), because staff reading the same tables can see more.

type Db = Awaited<ReturnType<typeof createClient>>;
const NO_CREDITS = { balance: 0, reserved: 0, available: 0 };

export async function loadCoaching(supabase: Db, clientId: string, opts: { drafts: boolean }): Promise<MemberCoaching> {
  const empty: MemberCoaching = { available: false, sessions: [], summaries: [], commitments: [], updates: [], drafts: [], shares: [] };
  const [sessions, summaries, commitments, updates, drafts, shares] = await Promise.all([
    supabase.from("coaching_sessions").select("id, scheduled_at, timezone, duration_minutes, state, location").eq("client_id", clientId).order("scheduled_at", { ascending: false }),
    supabase.from("session_summaries").select("id, session_id, revision, content, published_at").eq("client_id", clientId).eq("status", "published").order("published_at", { ascending: false }),
    supabase.from("session_commitments").select("id, summary_id, session_id, owner, body, due_date, status, goal_id").eq("client_id", clientId).eq("visible_to_client", true).order("position"),
    supabase.from("commitment_updates").select("id, commitment_id, progress, note, support_requested, created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
    // Unshared preparation is private to the member, so only they load it.
    opts.drafts ? supabase.from("prep_drafts").select("id, session_id, content, updated_at").eq("client_id", clientId) : Promise.resolve({ data: [] }),
    supabase.from("prep_shares").select("id, session_id, content, shared_at").eq("client_id", clientId).order("shared_at", { ascending: false }),
  ]);
  if (sessions.error) return empty;
  return {
    available: true,
    sessions: (sessions.data ?? []) as MemberCoaching["sessions"],
    summaries: (summaries.data ?? []) as MemberCoaching["summaries"],
    commitments: (commitments.data ?? []) as MemberCoaching["commitments"],
    updates: (updates.data ?? []) as MemberCoaching["updates"],
    drafts: (drafts.data ?? []) as MemberCoaching["drafts"],
    shares: (shares.data ?? []) as MemberCoaching["shares"],
  };
}

export async function loadBilling(supabase: Db, clientId: string): Promise<MyBilling> {
  const empty: MyBilling = { available: false, invoices: [], credits: NO_CREDITS, cardPayments: false };
  const [{ data: invoices, error }, { data: pos }, { data: notices }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, status, number, issue_date, due_date, total_pence, pdf_status, payment_instructions, credits_purchased, void_reason")
      .eq("client_id", clientId)
      .neq("status", "draft")
      .order("sequence", { ascending: false }),
    supabase.rpc("credit_position", { p_client: clientId }),
    supabase.from("payment_notices").select("invoice_id, status").eq("client_id", clientId),
  ]);
  if (error) return empty;
  const rows = await Promise.all(
    (invoices ?? []).map(async (inv) => {
      const { data } = await supabase.rpc("invoice_position", { p_invoice: inv.id });
      const p = ((Array.isArray(data) ? data[0] : data) ?? { paid: 0, credited: 0, balance: inv.total_pence }) as { paid: number; credited: number; balance: number };
      return {
        ...(inv as MyBilling["invoices"][number]),
        paid_pence: p.paid,
        credited_pence: p.credited,
        balance_pence: Math.max(p.balance, 0),
        noticeSent: (notices ?? []).some((n) => n.invoice_id === inv.id && n.status === "new"),
      };
    })
  );
  return {
    available: true,
    invoices: rows,
    credits: (Array.isArray(pos) ? pos[0] : pos) ?? NO_CREDITS,
    cardPayments: stripeStatus().ready,
  };
}

// Packages on offer to this client right now, decided by the same database
// rule the member's own page uses.
export async function loadOfferedPackages(supabase: Db, clientId: string, columns: string): Promise<Package[]> {
  const { data, error } = await supabase.from("packages").select(columns).order("position").order("price_pence");
  if (error) return [];
  const all = (data ?? []) as unknown as Package[];
  const open = await Promise.all(all.map((p) => supabase.rpc("_package_open", { p_package: p.id, p_client: clientId })));
  return all.filter((_, i) => open[i].data === true);
}
