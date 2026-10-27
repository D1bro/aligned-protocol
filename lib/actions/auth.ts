"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/email";
import { readGuestWork, saveGuestWorkToAccount } from "@/lib/guest-transfer";
import { joiningDestination } from "@/lib/continue-journey";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

export async function signIn(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { ok: false, message: "Enter your email and password." };

  const supabase = await createClient();

  // Signing in from a guest session (e.g. someone with an account who took
  // the audit before signing in): gather the guest's work first, while the
  // guest session can still read it, so it isn't left behind.
  const {
    data: { user: current },
  } = await supabase.auth.getUser();
  const guestWork = current?.is_anonymous ? await readGuestWork(supabase, current.id) : [];

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: error.message };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  let next = "/";
  if (guestWork.length && profile?.role === "client") {
    try {
      await saveGuestWorkToAccount(supabase, data.user.id, guestWork);
      // Carry on with the starting point they just brought in.
      next = await joiningDestination(supabase, data.user.id);
    } catch (e) {
      // Never block sign-in over this; the guest copy is still intact.
      console.error("Couldn't carry guest audit into account", e);
    }
  }

  redirect(profile?.role === "coach" || profile?.role === "admin" ? "/coach" : next);
}

// Client self-signup. Always creates role: 'client' — becoming a coach is a
// deliberate manual step in the Supabase table editor, not something anyone
// can grant themselves through the app.
export async function signUp(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!name || !email || !password) return { ok: false, message: "Fill in every field." };
  if (password.length < 8) return { ok: false, message: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const {
    data: { user: current },
  } = await supabase.auth.getUser();

  if (current?.is_anonymous) {
    // This person took the audit as a guest first. Convert their temporary
    // account into a real one in place, rather than creating a brand-new
    // account — that's what keeps the audit they already completed attached
    // to them instead of leaving it orphaned under the old anonymous id.
    const { data: updated, error } = await supabase.auth.updateUser({
      email,
      password,
      data: { full_name: name, role: "client" },
    });
    if (error) return { ok: false, message: error.message };

    // The profiles row already exists (created the moment the anonymous
    // account was made) but has no email/name yet — fill those in now rather
    // than waiting on email confirmation, so the account looks right
    // immediately even before they click the confirmation link.
    await supabase.from("profiles").update({ email, full_name: name }).eq("id", current.id);

    // Where email confirmation is switched off, the profile is ready now:
    // carry straight on into their first plan.
    if (updated.user?.email && !updated.user.new_email) redirect(await joiningDestination(supabase, current.id));

    return {
      ok: true,
      message: "Nearly there. Check your email and confirm your address: your snapshot is kept, and you’ll go straight on to build your first plan.",
    };
  }

  const { data: created, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, role: "client" } },
  });
  if (error) return { ok: false, message: error.message };
  if (created.session) redirect("/");

  return { ok: true, message: "Check your email to confirm your account, then sign in." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { ok: false, message: "Enter your email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Must be a full address; NEXT_PUBLIC_SITE_URL isn't set on Vercel.
    redirectTo: `${SITE_URL}/reset-password/confirm`,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// Save my plan, on Your plan is set: turns the guest into a real account in
// place (same as signUp above), so the plan built as a guest is already
// theirs. They stay on their plan while they confirm their email; the
// confirmation link (any device) lands on My profile with "your plan is saved".
export type SavePlanResult = { ok: true; confirmed: boolean; email: string } | { ok: false; message: string; exists?: boolean };

export async function saveGuestPlan(formData: FormData): Promise<SavePlanResult> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!name || !email || !password) return { ok: false, message: "Fill in your name, email and a password." };
  if (password.length < 8) return { ok: false, message: "Your password needs at least 8 characters." };

  const supabase = await createClient();
  const {
    data: { user: current },
  } = await supabase.auth.getUser();
  if (!current?.is_anonymous) return { ok: false, message: "This plan is already saved to an account." };

  const { data: updated, error } = await supabase.auth.updateUser({ email, password, data: { full_name: name, role: "client" } });
  if (error) {
    const exists = /already/i.test(error.message);
    return {
      ok: false,
      exists,
      message: exists ? "There’s already an account with this email. Sign in instead and your plan comes with you." : error.message,
    };
  }
  await supabase.from("profiles").update({ email, full_name: name }).eq("id", current.id);
  return { ok: true, confirmed: !!updated.user?.email && !updated.user.new_email, email };
}

// "Resend the email" while they wait to confirm.
export async function resendSaveEmail(email: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "email_change", email });
  if (error) return { ok: false, message: "Couldn’t resend just now. Wait a minute and try again." };
  return { ok: true };
}

// Whether the plan is saved yet: true once the email is confirmed, on this
// device or any other.
export async function planSaved(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user && !user.is_anonymous;
}
