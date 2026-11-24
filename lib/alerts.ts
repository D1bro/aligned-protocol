import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL, emailStatus, sendEmail } from "@/lib/email";
import { renderEmail, renderText } from "@/lib/email-layout";
import { isSet } from "@/lib/next-step";
import {
  auditAlert,
  signupAlert,
  type AlertKind,
  type AlertMessage,
  type Progress,
  type SignupRoute,
} from "@/lib/alert-content";

// Alert emails to Duane: new sign-ups, finished audits, coaching enquiries.
// They go to ENQUIRY_NOTIFY (set on Vercel). Every attempt is written to
// coach_alerts (migration 0036), sent or not, and a failure is also logged,
// so Site health can say "the last alert failed, and why" instead of the
// alert disappearing. Nothing here ever throws: the visitor's own action
// (signing up, finishing the audit) has already succeeded.

export const alertAddress = () => process.env.ENQUIRY_NOTIFY?.trim() || null;

export async function sendAlert(
  kind: AlertKind,
  message: AlertMessage,
  opts: { clientId?: string | null; replyTo?: string | null } = {}
): Promise<{ ok: boolean; reason?: string }> {
  const to = alertAddress();
  let ok = false;
  let reason: string | undefined;
  if (!to) {
    reason = "No alert address: ENQUIRY_NOTIFY isn’t set on Vercel.";
  } else {
    const sent = await sendEmail({
      to,
      subject: message.subject,
      html: renderEmail({ preheader: message.heading, heading: message.heading, blocks: message.blocks }),
      text: renderText({ heading: message.heading, blocks: message.blocks }),
      replyTo: opts.replyTo ?? null,
    }).catch(() => ({ ok: false as const, reason: "couldn’t send" }));
    ok = sent.ok;
    if (!sent.ok) reason = sent.reason;
  }
  if (!ok) console.error(`[alert:${kind}] not sent: ${reason}`);
  try {
    await createAdminClient()
      .from("coach_alerts")
      .insert({ kind, subject: message.subject.slice(0, 300), client_id: opts.clientId ?? null, ok, reason: reason?.slice(0, 500) ?? null });
  } catch {
    // The log is a convenience; never let it break anything.
  }
  return ok ? { ok } : { ok, reason };
}

// Where someone has got to: their latest audit, where they're starting, and
// their Next Step if it's set. Read with the service role, for the alert only.
async function progressFor(clientId: string): Promise<{ name: string | null; email: string | null; progress: Progress | null }> {
  const admin = createAdminClient();
  const [{ data: profile }, { data: audits }, { data: goals }] = await Promise.all([
    admin.from("profiles").select("full_name, email").eq("id", clientId).maybeSingle(),
    admin
      .from("audits")
      .select("total_score, sequence_number, focus_area")
      .eq("client_id", clientId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(2),
    admin
      .from("goals")
      .select("goal_title, focus_area, set_at, frequency, success_criteria")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const latest = audits?.[0];
  const goal = goals?.[0];
  return {
    name: (profile?.full_name as string | null) ?? null,
    email: (profile?.email as string | null) ?? null,
    progress: latest
      ? {
          score: (latest.total_score as number | null) ?? null,
          auditNumber: (latest.sequence_number as number | null) ?? null,
          area: (goal?.focus_area as string | null) ?? (latest.focus_area as string | null) ?? null,
          step: goal && isSet(goal) ? ((goal.goal_title as string | null) ?? null) : null,
        }
      : null,
  };
}

// A new account. `name`/`email` are what they just typed: the profile row
// may not have caught up yet.
export async function alertSignup(clientId: string, route: SignupRoute, typed: { name: string; email: string }) {
  try {
    const found = await progressFor(clientId);
    const message = signupAlert({
      name: typed.name || found.name,
      email: typed.email || found.email,
      route,
      progress: found.progress,
      recordUrl: `${SITE_URL}/coach/clients/${clientId}`,
    });
    await sendAlert("signup", message, { clientId, replyTo: typed.email || found.email });
  } catch (e) {
    console.error("[alert:signup] failed", e);
  }
}

// A finished audit by someone with an account. (A guest's audit arrives with
// their sign-up alert instead: until then there's no one to contact.)
export async function alertAuditDone(clientId: string) {
  try {
    const admin = createAdminClient();
    const [found, { data: audits }] = await Promise.all([
      progressFor(clientId),
      admin
        .from("audits")
        .select("total_score, sequence_number")
        .eq("client_id", clientId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(2),
    ]);
    const [latest, previous] = audits ?? [];
    if (!latest) return;
    const message = auditAlert({
      name: found.name,
      email: found.email,
      score: (latest.total_score as number | null) ?? 0,
      auditNumber: (latest.sequence_number as number | null) ?? 1,
      previousScore: (previous?.total_score as number | null) ?? null,
      recordUrl: `${SITE_URL}/coach/clients/${clientId}`,
    });
    await sendAlert("audit", message, { clientId, replyTo: found.email });
  } catch (e) {
    console.error("[alert:audit] failed", e);
  }
}

// For Site health: is everything in place, and how have recent alerts gone?
export type AlertHealth = {
  address: string | null;
  emailReady: boolean;
  installed: boolean; // migration 0036
  lastSent: { at: string; subject: string } | null;
  lastFailed: { at: string; subject: string; reason: string | null } | null;
};

export async function getAlertHealth(): Promise<AlertHealth> {
  const address = alertAddress();
  const emailReady = emailStatus().ready;
  try {
    const admin = createAdminClient();
    const [sent, failed] = await Promise.all([
      admin.from("coach_alerts").select("created_at, subject").eq("ok", true).order("created_at", { ascending: false }).limit(1),
      admin.from("coach_alerts").select("created_at, subject, reason").eq("ok", false).order("created_at", { ascending: false }).limit(1),
    ]);
    if (sent.error) return { address, emailReady, installed: false, lastSent: null, lastFailed: null };
    const s = sent.data?.[0];
    const f = failed.data?.[0];
    return {
      address,
      emailReady,
      installed: true,
      lastSent: s ? { at: s.created_at as string, subject: s.subject as string } : null,
      lastFailed: f ? { at: f.created_at as string, subject: f.subject as string, reason: (f.reason as string | null) ?? null } : null,
    };
  } catch {
    return { address, emailReady, installed: false, lastSent: null, lastFailed: null };
  }
}
