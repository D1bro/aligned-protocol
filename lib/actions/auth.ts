"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/email";
import { readGuestWork, saveGuestWorkToAccount } from "@/lib/guest-transfer";

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

  if (guestWork.length && profile?.role === "client") {
    try {
      await saveGuestWorkToAccount(supabase, data.user.id, guestWork);
    } catch (e) {
      // Never block sign-in over this; the guest copy is still intact.
      console.error("Couldn't carry guest audit into account", e);
    }
  }

  redirect(profile?.role === "coach" || profile?.role === "admin" ? "/coach" : "/");
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
    const { error } = await supabase.auth.updateUser({
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

    return { ok: true, message: "Check your email to confirm your account — your results are saved and waiting." };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, role: "client" } },
  });
  if (error) return { ok: false, message: error.message };

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
