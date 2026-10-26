"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, setRole, type StaffRole } from "@/lib/actions/admin";
import { canBill } from "@/lib/actions/billing";

// Console Settings → Team and access. Admins manage who is on the team;
// billing admins also choose who else can manage billing (migration 0019).

export type TeamMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: StaffRole;
  can_manage_billing: boolean;
  clients: number;
};
type Result = { ok: true; message?: string } | { ok: false; message: string };

export async function getTeam(): Promise<{ meId: string; canBill: boolean; members: TeamMember[] }> {
  const me = await requireAdmin();
  const supabase = await createClient();
  const [{ data }, billing] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, can_manage_billing").in("role", ["coach", "admin"]).order("full_name"),
    canBill(),
  ]);
  const ids = (data ?? []).map((m) => m.id as string);
  const { data: assigned } = ids.length
    ? await supabase.from("profiles").select("coach_id").eq("role", "client").in("coach_id", ids)
    : { data: [] };
  const members = ((data ?? []) as Omit<TeamMember, "clients">[]).map((m) => ({
    ...m,
    clients: (assigned ?? []).filter((a) => a.coach_id === m.id).length,
  }));
  // Admins first, then coaches; you at the top of your group.
  members.sort((a, b) => (a.role === b.role ? (a.id === me.id ? -1 : b.id === me.id ? 1 : 0) : a.role === "admin" ? -1 : 1));
  return { meId: me.id, canBill: billing, members };
}

export async function setBilling(userId: string, on: boolean): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_billing", { p_user: userId, p_on: on });
  if (error) {
    if (/your own/.test(error.message)) return { ok: false, message: "You can’t remove your own billing access." };
    if (/admin first/.test(error.message)) return { ok: false, message: "Make them an admin first." };
    if (/billing admin/.test(error.message)) return { ok: false, message: "Only someone with billing access can change this." };
    return { ok: false, message: "Couldn’t change billing access — try again." };
  }
  revalidatePath("/coach", "layout");
  return { ok: true };
}

export async function changeTeamRole(userId: string, role: "client" | "coach" | "admin"): Promise<Result> {
  const result = await setRole(userId, role);
  if (result.ok) return { ok: true };
  const m = result.message ?? "";
  if (/your own/.test(m)) return { ok: false, message: "You can’t remove your own admin access." };
  if (/billing admin/.test(m)) return { ok: false, message: "Only someone with billing access can change a billing admin’s role." };
  return { ok: false, message: "Couldn’t change the role — try again." };
}

// Add an existing account (they sign up first) to the team as a coach or admin.
export async function addToTeam(email: string, role: "coach" | "admin"): Promise<Result> {
  await requireAdmin();
  const address = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return { ok: false, message: "Enter their email address." };
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, role").ilike("email", address).limit(1).maybeSingle();
  if (!data) return { ok: false, message: "No account uses that email yet. Ask them to sign up first, then add them here." };
  if (data.role === role) return { ok: false, message: `${data.full_name || address} is already ${role === "admin" ? "an admin" : "a coach"}.` };
  const result = await changeTeamRole(data.id as string, role);
  if (!result.ok) return result;
  return { ok: true, message: `${data.full_name || address} is now ${role === "admin" ? "an admin" : "a coach"}.` };
}
