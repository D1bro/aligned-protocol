"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions/admin";
import { canBill } from "@/lib/actions/billing";
import { parsePounds } from "@/lib/money";

// Packages: session bundles and deals (migration 0018). Admins set them up;
// clients buy the ones on offer to them. Buying issues a normal invoice,
// paid by card or bank transfer as now; the sessions arrive once it's paid.

export type Package = {
  id: string;
  name: string;
  description: string | null;
  price_pence: number;
  sessions: number;
  valid_days: number | null;
  available_from: string | null;
  available_until: string | null;
  audience: "everyone" | "selected";
  active: boolean;
  position: number;
  // Aligned Focus: unlocks this membership for the "use within" days (0022).
  includes_membership: "practice" | "momentum" | null;
};
export type AdminPackage = Package & { clientIds: string[]; sold: number };
type Result = { ok: true; id?: string } | { ok: false; message: string };

const COLUMNS = "id, name, description, price_pence, sessions, valid_days, available_from, available_until, audience, active, position, includes_membership";

async function requireBilling() {
  await requireAdmin();
  if (!(await canBill())) redirect("/coach");
}

// Admin: every package, with who it's offered to and how many were sold.
export async function getAllPackages(): Promise<AdminPackage[] | null> {
  await requireBilling();
  const supabase = await createClient();
  const [{ data, error }, { data: audience }, { data: sold }] = await Promise.all([
    supabase.from("packages").select(COLUMNS).order("active", { ascending: false }).order("position").order("created_at"),
    supabase.from("package_audience").select("package_id, client_id"),
    supabase.from("invoices").select("package_id").not("package_id", "is", null).neq("status", "void").neq("status", "draft"),
  ]);
  if (error) return null; // migration 0018 not run yet
  return ((data ?? []) as Package[]).map((p) => ({
    ...p,
    clientIds: (audience ?? []).filter((a) => a.package_id === p.id).map((a) => a.client_id as string),
    sold: (sold ?? []).filter((s) => s.package_id === p.id).length,
  }));
}

// Admin: create or update a package. Price changes apply to new purchases
// only; invoices already issued keep their own price and terms.
export async function savePackage(input: {
  id: string | null;
  name: string;
  description: string;
  price: string;
  sessions: string;
  validDays: string;
  availableFrom: string;
  availableUntil: string;
  audience: "everyone" | "selected";
  clientIds: string[];
  active: boolean;
  includesMembership: "" | "practice" | "momentum";
}): Promise<Result> {
  await requireBilling();
  const name = input.name.trim();
  const price = parsePounds(input.price);
  const sessions = Number(input.sessions);
  const days = input.validDays.trim() ? Number(input.validDays) : null;
  const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  if (!name) return { ok: false, message: "Give the package a name." };
  if (price === null || price < 100) return { ok: false, message: "Enter a price of at least £1 (e.g. 300 or 300.00)." };
  if (!Number.isInteger(sessions) || sessions < 1 || sessions > 100) return { ok: false, message: "Sessions must be a whole number from 1 to 100." };
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 730)) return { ok: false, message: "'Use within' must be 1 to 730 days, or left blank for no expiry." };
  const from = date(input.availableFrom), until = date(input.availableUntil);
  if (from && until && until < from) return { ok: false, message: "The offer can't end before it starts." };
  if (input.audience === "selected" && !input.clientIds.length) return { ok: false, message: "Choose at least one client, or offer it to everyone." };

  const supabase = await createClient();
  const row = {
    name: name.slice(0, 120),
    description: input.description.trim().slice(0, 1000) || null,
    price_pence: price,
    sessions,
    valid_days: days,
    available_from: from,
    available_until: until,
    audience: input.audience,
    active: input.active,
    includes_membership: input.includesMembership || null,
  };
  const { data, error } = input.id
    ? await supabase.from("packages").update(row).eq("id", input.id).select("id").single()
    : await supabase.from("packages").insert(row).select("id").single();
  if (error || !data) return { ok: false, message: "Couldn’t save the package — try again." };
  await supabase.from("package_audience").delete().eq("package_id", data.id);
  if (input.audience === "selected") {
    const { error: aErr } = await supabase
      .from("package_audience")
      .insert([...new Set(input.clientIds)].slice(0, 200).map((client_id) => ({ package_id: data.id, client_id })));
    if (aErr) return { ok: false, message: "Saved, but couldn’t save who it’s offered to — try again." };
  }
  revalidatePath("/coach/billing/packages");
  revalidatePath("/coaching");
  return { ok: true, id: data.id };
}

// Member: the packages on offer to them right now (database rules decide).
export async function getOfferedPackages(): Promise<Package[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("packages").select(COLUMNS).order("position").order("price_pence");
  return error ? [] : ((data ?? []) as Package[]);
}

// Member: buy one. Issues their invoice (or returns the unpaid one already
// issued for it); they then pay by card or bank transfer on the same page.
export async function buyPackage(packageId: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buy_package", { p_package: packageId });
  if (error) {
    const m = error.message;
    if (/Create your account/.test(m)) return { ok: false, message: "Create your account first, then you can buy sessions." };
    if (/isn't available/.test(m)) return { ok: false, message: "This package isn’t available any more." };
    if (/Missing/.test(m)) return { ok: false, message: "Buying isn’t quite set up yet. Please contact Duane, who’ll sort it." };
    return { ok: false, message: "Couldn’t start the purchase — try again." };
  }
  revalidatePath("/coaching");
  revalidatePath("/");
  return { ok: true, id: data as string };
}

// Admin: start a draft invoice for a client from a package, to review and issue.
export async function draftInvoiceFromPackage(clientId: string, packageId: string): Promise<Result> {
  await requireBilling();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("draft_invoice_from_package", { p_client: clientId, p_package: packageId });
  if (error) return { ok: false, message: "Couldn’t create the draft — try again." };
  revalidatePath(`/coach/clients/${clientId}`);
  revalidatePath("/coach/billing");
  return { ok: true, id: data as string };
}

// When the client's credits next expire, soonest first.
export async function getMyExpiries(): Promise<{ expires_at: string; quantity: number }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.rpc("credit_expiries", { p_client: user.id });
  return error ? [] : ((data ?? []) as { expires_at: string; quantity: number }[]);
}

// Member: their session balance (expiry already taken into account).
export async function getMyCredits(): Promise<{ balance: number; reserved: number; available: number } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc("credit_position", { p_client: user.id });
  if (error) return null;
  return ((Array.isArray(data) ? data[0] : data) ?? null) as { balance: number; reserved: number; available: number } | null;
}
