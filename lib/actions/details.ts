"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkDetails, type DetailsInput } from "@/lib/details";

// "Your details" for the signed-in member (migration 0016). Only the fields
// in lib/details.ts are ever written: the profile's own row for contact and
// location, and save_my_billing_details for billing name and address. Role,
// coach, email and everything else are untouched (and the database refuses
// them anyway).

const CONTACT = "full_name, preferred_name, phone, town, country, timezone, details_prompt_dismissed_at";

export type MyDetails = {
  available: boolean; // false until migration 0016 is applied
  email: string | null;
  full_name: string | null;
  preferred_name: string | null;
  phone: string | null;
  town: string | null;
  country: string | null;
  timezone: string | null;
  billing_name: string | null;
  billing_address: string | null;
  promptDismissed: boolean;
  hasCoach: boolean;
};

async function requireMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login");
  return { supabase, userId: user.id };
}

export async function getMyDetails(): Promise<MyDetails> {
  const { supabase, userId } = await requireMember();
  const [{ data: base }, { data: extra, error }, { data: billing }] = await Promise.all([
    supabase.from("profiles").select("email, full_name, coach_id").eq("id", userId).single(),
    supabase.from("profiles").select(CONTACT).eq("id", userId).single(),
    supabase.from("billing_customers").select("name, address").eq("client_id", userId).maybeSingle(),
  ]);
  const x = (error ? {} : extra ?? {}) as Record<string, string | null>;
  return {
    available: !error,
    email: base?.email ?? null,
    full_name: base?.full_name ?? null,
    preferred_name: x.preferred_name ?? null,
    phone: x.phone ?? null,
    town: x.town ?? null,
    country: x.country ?? null,
    timezone: x.timezone ?? null,
    billing_name: (billing?.name as string | undefined) ?? null,
    billing_address: (billing?.address as string | undefined) ?? null,
    promptDismissed: Boolean(x.details_prompt_dismissed_at),
    hasCoach: Boolean(base?.coach_id),
  };
}

export type SaveResult = { ok: true } | { ok: false; field?: keyof DetailsInput; message: string };

export async function saveMyDetails(input: Partial<Record<keyof DetailsInput, unknown>>): Promise<SaveResult> {
  const { supabase, userId } = await requireMember();
  const checked = checkDetails(input);
  if (!checked.ok) return checked;
  const v = checked.values;

  const { data: saved, error } = await supabase
    .from("profiles")
    .update({
      full_name: v.full_name,
      preferred_name: v.preferred_name,
      phone: v.phone,
      town: v.town,
      country: v.country,
      timezone: v.timezone,
    })
    .eq("id", userId)
    .select("id");
  if (error || !saved?.length) return { ok: false, message: "Couldn’t save your details — check your connection and try again." };

  const { error: billingError } = await supabase.rpc("save_my_billing_details", { p_name: v.billing_name ?? "", p_address: v.billing_address ?? "" });
  if (billingError) {
    return { ok: false, field: "billingAddress", message: "Your contact details were saved, but your billing details weren’t. Try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

// "Later" on the My profile invitation: stop showing it.
export async function dismissDetailsPrompt(): Promise<void> {
  const { supabase, userId } = await requireMember();
  await supabase.from("profiles").update({ details_prompt_dismissed_at: new Date().toISOString() }).eq("id", userId);
  revalidatePath("/");
}

// For the coach's client page: the contact details the member has chosen to
// add. Visible to the assigned coach (and admins) by the profiles rules;
// billing details are deliberately not included.
export async function getClientContact(clientId: string): Promise<Pick<MyDetails, "preferred_name" | "phone" | "town" | "country" | "timezone"> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("preferred_name, phone, town, country, timezone").eq("id", clientId).maybeSingle();
  if (error || !data) return null;
  return data as Pick<MyDetails, "preferred_name" | "phone" | "town" | "country" | "timezone">;
}
