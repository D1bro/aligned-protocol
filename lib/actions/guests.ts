"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/actions/admin";
import { idleGuests, isProtected, latest, type GuestRow } from "@/lib/guests";

// Guest management for admins (/coach/clients/guests). Guests have no email,
// so they're read and removed through the server's admin client. Every
// removal re-reads the guest first and refuses anyone who has an account,
// asked about coaching, or has a billing record — whatever the page sent.

type Admin = ReturnType<typeof createAdminClient>;
type Result = { ok: true; message: string } | { ok: false; message: string };

const CHUNK = 90;
const chunks = <T,>(xs: T[], n = CHUNK) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

// Rows from one table for many people, in chunks small enough to stay under
// the database's 1,000-row limit per request.
async function rowsFor<T>(admin: Admin, table: string, columns: string, key: string, ids: string[]): Promise<T[]> {
  const out: T[] = [];
  for (const part of chunks(ids)) {
    const { data, error } = await admin.from(table).select(columns).in(key, part).limit(1000);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

// Every anonymous sign-in with no email, as auth sees it.
async function anonymousUsers(admin: Admin, only?: Set<string>) {
  const users: { id: string; created_at: string; last_sign_in_at?: string | null }[] = [];
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    for (const u of data.users) if (u.is_anonymous && !u.email && (!only || only.has(u.id))) users.push(u);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function loadGuests(admin: Admin, only?: Set<string>): Promise<GuestRow[]> {
  const users = await anonymousUsers(admin, only);
  const ids = users.map((u) => u.id);
  if (!ids.length) return [];

  // Only client profiles with no email count as guests.
  const profiles = await rowsFor<{ id: string; role: string; email: string | null }>(admin, "profiles", "id, role, email", "id", ids);
  const guestIds = new Set(profiles.filter((p) => p.role === "client" && !p.email).map((p) => p.id));
  const gids = ids.filter((id) => guestIds.has(id));

  const audits = await rowsFor<{ id: string; client_id: string; status: string; total_score: number | null; completed_at: string | null; created_at: string }>(
    admin, "audits", "id, client_id, status, total_score, completed_at, created_at", "client_id", gids);
  const responses = await rowsFor<{ audit_id: string; created_at: string }>(admin, "audit_responses", "audit_id, created_at", "audit_id", audits.map((a) => a.id));
  const [enquiries, sessions, invoices, receipts, credits] = await Promise.all([
    rowsFor<{ client_id: string }>(admin, "coaching_enquiries", "client_id", "client_id", gids),
    rowsFor<{ client_id: string }>(admin, "coaching_sessions", "client_id", "client_id", gids),
    rowsFor<{ client_id: string }>(admin, "invoices", "client_id", "client_id", gids),
    rowsFor<{ client_id: string }>(admin, "receipts", "client_id", "client_id", gids),
    rowsFor<{ client_id: string }>(admin, "credit_notes", "client_id", "client_id", gids),
  ]);
  const coaching = new Set([...enquiries, ...sessions].map((r) => r.client_id));
  const billing = new Set([...invoices, ...receipts, ...credits].map((r) => r.client_id));

  const answersByAudit = new Map<string, { n: number; last: string | null }>();
  for (const r of responses) {
    const cur = answersByAudit.get(r.audit_id) ?? { n: 0, last: null };
    answersByAudit.set(r.audit_id, { n: cur.n + 1, last: latest(cur.last, r.created_at) });
  }

  return users
    .filter((u) => guestIds.has(u.id))
    .map((u) => {
      const mine = audits.filter((a) => a.client_id === u.id);
      const done = mine.filter((a) => a.status === "completed").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))[0];
      const answered = Math.max(0, ...mine.map((a) => answersByAudit.get(a.id)?.n ?? 0));
      return {
        id: u.id,
        createdAt: u.created_at,
        lastActiveAt:
          latest(u.created_at, u.last_sign_in_at, ...mine.map((a) => a.completed_at), ...mine.map((a) => answersByAudit.get(a.id)?.last)) ?? u.created_at,
        answered,
        finished: !!done,
        score: done?.total_score ?? null,
        enquiry: coaching.has(u.id),
        billing: billing.has(u.id),
      };
    })
    .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
}

export async function getGuests(): Promise<{ ok: true; guests: GuestRow[]; now: number } | { ok: false; message: string }> {
  await requireAdmin();
  try {
    return { ok: true, guests: await loadGuests(createAdminClient()), now: Date.now() };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn’t load guests." };
  }
}

async function remove(admin: Admin, guests: GuestRow[]): Promise<{ removed: number; failed: number }> {
  let removed = 0;
  let failed = 0;
  for (const part of chunks(guests, 5)) {
    const results = await Promise.all(part.map((g) => admin.auth.admin.deleteUser(g.id)));
    for (const r of results) {
      if (r.error) failed++;
      else removed++;
    }
  }
  return { removed, failed };
}

const plural = (n: number) => `${n} guest${n === 1 ? "" : "s"}`;

export async function removeGuest(id: string): Promise<Result> {
  await requireAdmin();
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Unknown guest." };
  try {
    const admin = createAdminClient();
    const [g] = await loadGuests(admin, new Set([id]));
    if (!g) return { ok: false, message: "This isn’t a guest (they may have an account now), so it wasn’t removed." };
    if (g.billing) return { ok: false, message: "This guest has a billing record, so they’re kept." };
    if (g.enquiry) return { ok: false, message: "This guest asked about coaching, so they’re kept." };
    const { removed } = await remove(admin, [g]);
    revalidatePath("/coach", "layout");
    return removed ? { ok: true, message: "Guest removed." } : { ok: false, message: "Couldn’t remove the guest — try again." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn’t remove the guest." };
  }
}

// Removes every unfinished guest idle for at least `idleDays` days, decided
// here from fresh data rather than from the list on the page.
export async function removeIdleGuests(idleDays: number): Promise<Result> {
  await requireAdmin();
  if (!Number.isInteger(idleDays) || idleDays < 1) return { ok: false, message: "Choose how long they’ve been idle." };
  try {
    const admin = createAdminClient();
    const targets = idleGuests(await loadGuests(admin), idleDays, Date.now()).filter((g) => !isProtected(g));
    if (!targets.length) return { ok: true, message: "Nothing to remove." };
    const { removed, failed } = await remove(admin, targets);
    revalidatePath("/coach", "layout");
    if (failed) return { ok: false, message: `Removed ${plural(removed)}; ${plural(failed)} couldn’t be removed — try again.` };
    return { ok: true, message: `Removed ${plural(removed)}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn’t remove guests." };
  }
}
