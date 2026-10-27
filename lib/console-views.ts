import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DID_IT_LABELS, WEEKLY_LABELS } from "@/lib/checkin-labels";
import { formatDate } from "@/lib/audit-schedule";
import type { ClientSummary } from "@/lib/actions/admin";

// The lists behind each Overview number: who completed audits, who set plans,
// every goal check-in, who's learning. Used by the Clients page and its CSV
// export so both show exactly the same rows. Access is the database's job:
// an admin sees everyone, a coach only their own clients.

export type ViewKey = "audits" | "plans" | "checkins" | "lessons";

export type ViewRow = { personId: string; cells: string[]; date: string | null };
export type View = { key: ViewKey; title: string; lead: string; columns: string[]; rows: ViewRow[] };

export const VIEW_LABELS: Record<ViewKey, string> = {
  audits: "Audits completed",
  plans: "Plans set",
  checkins: "Goal check-ins",
  lessons: "Lessons completed",
};

const NEXT: Record<string, string> = { keep: "Kept going", adjust: "Adjusted", done: "Goal done" };

export function personName(p: { full_name: string | null; email: string | null } | undefined) {
  if (!p) return "Unknown";
  if (!p.email) return "Guest (no account)";
  return p.full_name?.trim() || p.email;
}

export async function buildView(
  key: ViewKey,
  opts: { includeGuests: boolean; status?: string; didIt?: boolean },
  summaries: ClientSummary[]
): Promise<View> {
  const supabase = await createClient();
  const people = new Map(summaries.map((s) => [s.id, s]));
  const allowed = (id: string) => {
    const p = people.get(id);
    return !!p && (opts.includeGuests || !!p.email);
  };

  if (key === "audits") {
    const { data } = await supabase
      .from("audits")
      .select("id, client_id, total_score, completed_at, sequence_number")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1000);
    const rows = (data ?? [])
      .filter((a) => allowed(a.client_id))
      .map((a) => ({
        personId: a.client_id as string,
        date: a.completed_at as string,
        cells: [personName(people.get(a.client_id)), `${a.total_score ?? 0}/100`, `Audit ${a.sequence_number}`, formatDate(a.completed_at as string)],
      }));
    return { key, title: VIEW_LABELS.audits, lead: "Every completed audit, newest first. Scores are self-reported.", columns: ["Person", "Total", "Which", "Completed"], rows };
  }

  if (key === "plans") {
    let q = supabase
      .from("goals")
      .select("id, client_id, goal_title, focus_area, status, frequency, success_criteria, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (opts.status) q = q.eq("status", opts.status);
    const { data } = await q;
    const status: Record<string, string> = { active: "Active", completed: "Done", abandoned: "Let go" };
    const rows = (data ?? [])
      .filter((g) => allowed(g.client_id) && (g.frequency ?? "").trim() && (g.success_criteria ?? "").trim())
      .map((g) => ({
        personId: g.client_id as string,
        date: g.created_at as string,
        cells: [personName(people.get(g.client_id)), g.focus_area ?? "—", g.goal_title ?? "—", status[g.status as string] ?? g.status, formatDate(g.created_at as string)],
      }));
    return {
      key,
      title: opts.status === "completed" ? "Goals completed" : VIEW_LABELS.plans,
      lead: "Goals with an action, a time and what 'done' looks like.",
      columns: ["Person", "Area", "Goal", "Status", "Set"],
      rows,
    };
  }

  if (key === "checkins") {
    let q = supabase
      .from("goal_checkins")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (opts.didIt) q = q.not("did_it", "in", "(not_yet,missed)");
    const { data } = await q;
    const rows = (data ?? [])
      .filter((c) => allowed(c.client_id))
      .map((c) => ({
        personId: c.client_id as string,
        date: c.created_at as string,
        cells: [
          personName(people.get(c.client_id)),
          c.kind === "weekly" ? `Weekly · ${WEEKLY_LABELS[c.did_it as string] ?? c.did_it}` : DID_IT_LABELS[c.did_it as keyof typeof DID_IT_LABELS] ?? c.did_it,
          c.kind === "weekly" ? "—" : `${c.area_score}/10`,
          (c.kind === "weekly" ? WEEKLY_LABELS[c.next_step as string] : NEXT[c.next_step as string]) ?? c.next_step,
          formatDate(c.created_at as string),
        ],
      }));
    return {
      key,
      title: opts.didIt ? "Recorded an action" : VIEW_LABELS.checkins,
      lead: "Every weekly and monthly review, newest first. Area scores (monthly) are self-reported.",
      columns: ["Person", "Did it", "Area now", "Next", "Date"],
      rows,
    };
  }

  // lessons: counts per person (completions marked private still count).
  const rows = summaries
    .filter((s) => s.lessons_done > 0 && (opts.includeGuests || !!s.email))
    .sort((a, b) => b.lessons_done - a.lessons_done)
    .map((s) => ({
      personId: s.id,
      date: s.last_active_at,
      cells: [personName(s), `${s.lessons_done} of 4`, s.last_active_at ? formatDate(s.last_active_at) : "—"],
    }));
  return { key, title: VIEW_LABELS.lessons, lead: "People who have completed Academy lessons.", columns: ["Person", "Lessons", "Last active"], rows };
}

const DAY = 86_400_000;
export const STAGES: Record<string, { label: string; test: (c: ClientSummary) => boolean }> = {
  "no-audit": { label: "No audit yet", test: (c) => c.audits === 0 },
  "no-plan": { label: "Audit done, no plan", test: (c) => c.audits > 0 && !c.plan_set },
  "no-checkin": { label: "Plan set, no check-in", test: (c) => c.plan_set && c.checkins === 0 },
  active: { label: "Checking in", test: (c) => c.checkins > 0 },
  quiet: { label: "Quiet 30+ days", test: (c) => !!c.last_active_at && Date.now() - new Date(c.last_active_at).getTime() > 30 * DAY },
  audited: { label: "Has done an audit", test: (c) => c.audits > 0 },
  active30: { label: "Active in 30 days", test: (c) => !!c.last_active_at && Date.now() - new Date(c.last_active_at).getTime() <= 30 * DAY },
};

// The People list's search and filters.
export function filterPeople(
  all: ClientSummary[],
  f: { q: string; coach: string; stage: string; guests: boolean },
  meId: string
) {
  const needle = f.q.trim().toLowerCase();
  return all
    .filter((c) => (f.guests ? true : !!c.email))
    .filter((c) => !needle || `${c.full_name ?? ""} ${c.email ?? ""}`.toLowerCase().includes(needle))
    .filter((c) => (f.coach === "all" ? true : f.coach === "none" ? !c.coach_id : f.coach === "me" ? c.coach_id === meId : c.coach_id === f.coach))
    .filter((c) => (STAGES[f.stage] ? STAGES[f.stage].test(c) : true));
}

export function stageOf(c: ClientSummary) {
  if (c.audits === 0) return "No audit yet";
  if (!c.plan_set) return c.active_goals ? "Plan in progress" : "Audit done";
  if (c.checkins === 0) return "Plan set";
  return `${c.checkins} check-in${c.checkins === 1 ? "" : "s"}`;
}
