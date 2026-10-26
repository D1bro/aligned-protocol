import Link from "next/link";
import { getClientProfile, getStaff } from "@/lib/actions/admin";
import { getLifeAreas } from "@/lib/actions/audit";
import { AREA_SHORT_NAMES } from "@/lib/audit-guides";
import { LifeMap } from "@/components/audit/LifeMap";
import { DID_IT_LABELS } from "@/lib/checkin-labels";
import { cleanReality } from "@/lib/clear-text";
import { formatDate } from "@/lib/audit-schedule";
import { PATHS } from "@/lib/learn-content";
import { stageOf } from "@/lib/console-views";
import { OverviewTab } from "./OverviewTab";
import { SessionsTab } from "./SessionsTab";
import { CoachNotesTab } from "./CoachNotesTab";
import { formatSessionTime } from "@/lib/time";
import { ClientSettings } from "./ClientSettings";
import { getClientContact } from "@/lib/actions/details";
import { localTimeLabel } from "@/lib/details";
import { RemoveGuestButton } from "../guests/GuestActions";
import { RemoveClient } from "./RemoveClient";
import { getRemovalCheck } from "@/lib/actions/remove-client";
import { ResetPasswordButton } from "./ResetPasswordButton";
import { BillingTab } from "./BillingTab";
import { getAllPackages } from "@/lib/actions/packages";
import { formatPence } from "@/lib/money";
import { getClientBilling } from "@/lib/actions/billing";
import { getMessageJobs } from "@/lib/actions/messages";

const TABS = [
  ["overview", "Overview"],
  ["sessions", "Sessions"],
  ["goals", "Goals and audit"],
  ["notes", "Coach notes"],
  ["billing", "Payments and invoices"],
  ["learning", "Learning"],
  ["settings", "Settings"],
] as const;
type Tab = (typeof TABS)[number][0];

const LESSONS = PATHS.flatMap((p) => p.lessons);
const STATUS: Record<string, string> = { active: "Active", completed: "Done", abandoned: "Let go" };
const NEXT: Record<string, string> = { keep: "Kept going", adjust: "Adjusted the action", done: "Marked the goal done" };
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

// A client's profile in the console: one tab per part of their journey.
export default async function ClientProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; a?: string; b?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = (TABS.map((t) => t[0]) as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "overview";
  const [p, areas, contact] = await Promise.all([getClientProfile(id), getLifeAreas(), getClientContact(id)]);
  const { viewer, client, summary } = p;
  const isAdmin = viewer.role === "admin";
  const staff = isAdmin && tab === "settings" ? await getStaff() : [];
  const removal = isAdmin && tab === "settings" && client.email ? await getRemovalCheck(client.id) : null;
  const billing = tab === "billing" || tab === "sessions" ? await getClientBilling(id) : null;
  const jobs = tab === "billing" || tab === "sessions" ? await getMessageJobs(id) : [];

  const scoresFor = (auditId: string) => {
    const rs = p.responses.filter((r) => r.audit_id === auditId);
    return areas.map((a) => rs.find((r) => r.life_area_id === a.id) ?? null);
  };
  const latest = p.audits[0] ?? null;
  const previous = p.audits[1] ?? null;
  const latestRows = latest ? scoresFor(latest.id) : [];
  const prevRows = previous ? scoresFor(previous.id) : [];
  const latestPlan = latest ? p.plans.find((pl) => pl.audit_id === latest.id) : null;
  const startIdx = latestPlan ? areas.findIndex((a) => a.id === latestPlan.life_area_id) : -1;

  const active = p.goals.filter((g) => g.status === "active").sort((x, y) => Number(y.goal_type === "primary") - Number(x.goal_type === "primary"));
  const mainGoal = active[0] ?? null;
  const mainPlan = mainGoal ? p.plans.find((pl) => pl.id === mainGoal.clear_plan_id) ?? null : null;
  const goalTitle = new Map(p.goals.map((g) => [g.id as string, str(g.goal_title) ?? "Goal"]));
  const name = client.full_name?.trim() || client.email || "Guest (no account)";
  const firstName = client.full_name?.trim().split(/\s+/)[0] || "them";
  const { sessions } = p.coaching;
  const upcoming = sessions
    .filter((x) => x.state === "proposed" || x.state === "confirmed")
    .sort((x, y) => new Date(x.scheduled_at).getTime() - new Date(y.scheduled_at).getTime());
  const nextConfirmed = upcoming.find((x) => x.state === "confirmed" && new Date(x.scheduled_at).getTime() >= Date.now()) ?? null;
  const nextAny = upcoming.find((x) => new Date(x.scheduled_at).getTime() >= Date.now()) ?? upcoming[0] ?? null;
  const held = sessions.filter((x) => x.state === "held").length;
  const bookedAhead = sessions.filter((x) => x.state === "confirmed" && new Date(x.scheduled_at).getTime() >= Date.now()).length;
  const focusIdx = mainGoal ? areas.findIndex((a) => a.name === str(mainGoal.focus_area)) : -1;
  const focusNote = focusIdx !== -1 ? latestRows[focusIdx]?.note ?? null : null;
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="page admin-page">
      <Link href="/coach/clients" className="tb-back" style={{ marginBottom: "1rem", display: "inline-flex" }}>
        ← All clients
      </Link>

      <header className="cp-head">
        <div className="cp-avatar" aria-hidden="true">{initials}</div>
        <div>
          <h1>{name}</h1>
          <p>
            {client.email ?? "Guest — no account yet"} · Joined {formatDate(client.created_at)} ·{" "}
            {p.coachName ? `Coach: ${p.coachName}` : "No coach"}
            {client.role !== "client" ? ` · ${client.role}` : ""}
            {p.coaching.relationship ? ` · Coaching: ${p.coaching.relationship.status}` : ""}
          </p>
        </div>
      </header>

      {contact && client.email ? (
        <details className="cp-contact">
          <summary>Contact and location</summary>
          {contact.preferred_name || contact.phone || contact.town || contact.country || contact.timezone ? (
            <dl>
              {contact.preferred_name ? <><dt>Preferred name</dt><dd>{contact.preferred_name}</dd></> : null}
              {contact.phone ? <><dt>Phone</dt><dd><a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>{contact.phone}</a></dd></> : null}
              {contact.town || contact.country ? <><dt>Location</dt><dd>{[contact.town, contact.country].filter(Boolean).join(", ")}</dd></> : null}
              {contact.timezone ? <><dt>Time zone</dt><dd>{localTimeLabel(contact.timezone) ? `Their time now: ${localTimeLabel(contact.timezone)}` : contact.timezone}</dd></> : null}
            </dl>
          ) : (
            <p>{firstName === "them" ? "They haven’t" : `${firstName} hasn’t`} added contact details yet.</p>
          )}
          <p>From their Your details page. Session times stay as booked; this is for reference.</p>
        </details>
      ) : null}

      <div className="cp-facts">
        <div><span>Current focus</span><b>{str(mainGoal?.focus_area) ?? "—"}</b></div>
        <div><span>Next confirmed</span><b>{nextConfirmed ? formatSessionTime(nextConfirmed.scheduled_at, nextConfirmed.timezone) : "—"}</b></div>
        <div><span>Sessions held</span><b>{held}</b></div>
        <div><span>Booked ahead</span><b>{bookedAhead}</b></div>
        <div><span>Stage</span><b>{summary ? stageOf(summary) : "—"}</b></div>
        <div><span>Last active</span><b>{summary?.last_active_at ? formatDate(summary.last_active_at) : "—"}</b></div>
      </div>
      {!p.coaching.available ? (
        <p className="plan-note">Sessions and coach notes need database update 0013. Run it, then reload.</p>
      ) : null}

      <nav className="admin-tabs cp-tabs" aria-label="Client sections">
        {TABS.filter(([k]) => k !== "settings" || isAdmin).map(([k, label]) => (
          <Link key={k} href={`/coach/clients/${client.id}?tab=${k}`} aria-current={tab === k ? "page" : undefined}>
            {label}
            {k === "sessions" && sessions.length ? ` ${sessions.length}` : ""}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <OverviewTab p={p} firstName={firstName} mainGoal={mainGoal} focusNote={focusNote} nextSession={nextAny} />
      ) : null}

      {tab === "sessions" ? <SessionsTab p={p} billing={billing} jobs={jobs} /> : null}

      {tab === "goals" ? (
        latest ? (
          <section aria-label="Latest audit">
            <p className="cp-sub">
              Audit {latest.sequence_number} · {formatDate(latest.completed_at)} · {latest.total_score ?? 0}/100
              {previous ? ` · ${(latest.total_score ?? 0) - (previous.total_score ?? 0) >= 0 ? "+" : ""}${(latest.total_score ?? 0) - (previous.total_score ?? 0)} since ${formatDate(previous.completed_at)}` : ""}
              {startIdx !== -1 ? ` · Starting area: ${areas[startIdx].name}` : ""}. Self-reported.
            </p>
            <div className="coach-audit">
              <div className="au-chart">
                <LifeMap
                  scores={latestRows.map((r) => r?.satisfaction_score ?? 0)}
                  compareScores={previous ? prevRows.map((r) => r?.satisfaction_score ?? 0) : undefined}
                  names={areas.map((a) => a.name)}
                  labels={areas.map((a) => AREA_SHORT_NAMES[a.sort_order] ?? a.name)}
                  highlightIndex={startIdx === -1 ? null : startIdx}
                />
              </div>
              <ol className="coach-answers">
                {areas.map((a, i) => {
                  const now = latestRows[i]?.satisfaction_score ?? 0;
                  const d = previous ? now - (prevRows[i]?.satisfaction_score ?? 0) : null;
                  return (
                    <li key={a.id}>
                      <div>
                        <b>{a.name}</b>
                        <span>
                          {now}/10
                          {d ? <em className={d > 0 ? "cp-up" : "cp-down"}> {d > 0 ? `+${d}` : d}</em> : null}
                        </span>
                      </div>
                      {latestRows[i]?.note ? <p>{latestRows[i]?.note}</p> : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        ) : (
          <Empty text="No completed audit yet." />
        )
      ) : null}

      {tab === "goals" ? (
        p.audits.length ? (
          <AuditsTab
            audits={p.audits}
            areas={areas}
            scoresFor={scoresFor}
            clientId={client.id}
            a={sp.a}
            b={sp.b}
          />
        ) : (
          <Empty text="No completed audits yet." />
        )
      ) : null}

      {tab === "goals" ? (
        p.goals.length ? (
          <section aria-label="Plan and goals">
            {mainGoal ? (
              <>
                <div className="sec-head">Main goal{str(mainGoal.focus_area) ? ` · ${str(mainGoal.focus_area)}` : ""}</div>
                <div className="coach-clear">
                  {[
                    ["Goal", str(mainGoal.goal_title)],
                    ["The change (next point up)", str(mainPlan?.step_up_answer)],
                    ["Why it matters", str(mainGoal.motivation_text)],
                    ["The action", str(mainGoal.action_text)],
                    ["When", str(mainGoal.action_when) ?? str(mainGoal.frequency)],
                    ["Done when", str(mainGoal.success_criteria)],
                    [
                      "If it gets hard",
                      str(mainPlan?.if_obstacle) && str(mainPlan?.if_response) ? `If ${str(mainPlan?.if_obstacle)}, then I’ll ${str(mainPlan?.if_response)}.` : null,
                    ],
                    ["C · Current reality", cleanReality(str(mainPlan?.current_reality))],
                    ["L · Life vision (a 10)", str(mainPlan?.life_vision)],
                    [
                      "E · What’s in the way",
                      [Array.isArray(mainPlan?.blocks) ? (mainPlan?.blocks as string[]).join(", ") : null, str(mainPlan?.emotional_blocks)].filter(Boolean).join(" — ") || null,
                    ],
                    ["Tried before", str(mainPlan?.tried_before)],
                    ["Set", formatDate(mainGoal.created_at as string)],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k as string}><span>{k}</span><p>{v}</p></div>
                    ))}
                </div>
              </>
            ) : null}
            <div className="sec-head">All goals</div>
            <ul className="past-goals">
              {p.goals.map((g) => (
                <li key={g.id as string}>
                  <span className={`past-status ${g.status}`}>
                    {g.id === mainGoal?.id ? "Main" : g.status === "completed" ? "✓ Done" : STATUS[g.status as string] ?? g.status}
                  </span>
                  <div>
                    <p>{str(g.goal_title)}</p>
                    <span>{[str(g.focus_area), `set ${formatDate(g.created_at as string)}`].filter(Boolean).join(" · ")}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <Empty text="No goals yet." />
        )
      ) : null}

      {tab === "goals" ? (
        p.checkIns.length ? (
          <>
          <h2 className="sec-head">Goal check-ins</h2>
          <ol className="checkin-list">
            {p.checkIns.map((c) => (
              <li key={c.id as string}>
                <div className="checkin-head">
                  <b>{formatDate(c.created_at as string)}</b>
                  <span>
                    {DID_IT_LABELS[c.did_it as keyof typeof DID_IT_LABELS]} · {c.area_score as number}/10 · {NEXT[c.next_step as string]}
                  </span>
                </div>
                <p><span>Goal:</span> {goalTitle.get(c.goal_id as string)}</p>
                {str(c.helped) ? <p><span>Helped:</span> {str(c.helped)}</p> : null}
                {str(c.got_in_way) ? <p><span>Got in the way:</span> {str(c.got_in_way)}</p> : null}
              </li>
            ))}
          </ol>
          </>
        ) : (
          <Empty text="No goal check-ins yet." />
        )
      ) : null}

      {tab === "learning" ? (
        <section aria-label="Learning">
          <p className="cp-sub">
            {summary?.lessons_done ?? 0} of {LESSONS.length} lessons completed. Reflections marked private aren&rsquo;t shown.
          </p>
          <ol className="checkin-list">
            {LESSONS.map((l) => {
              const r = p.reflections.find((x) => x.lesson_slug === l.slug);
              return (
                <li key={l.slug}>
                  <div className="checkin-head">
                    <b>{l.title}</b>
                    <span>{r?.completed_at ? `✓ Completed ${formatDate(r.completed_at)}` : r ? "Started" : "Not shared or not started"}</span>
                  </div>
                  {r?.reflection ? <p>{r.reflection}</p> : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {tab === "notes" ? <CoachNotesTab p={p} /> : null}

      {tab === "billing" && billing ? (
        <BillingTab
          b={billing}
          clientId={client.id}
          jobs={jobs}
          firstName={firstName}
          packages={
            billing.canBill
              ? ((await getAllPackages()) ?? [])
                  .filter((pk) => pk.active)
                  .map((pk) => ({ id: pk.id, label: `${pk.name} · ${formatPence(pk.price_pence)} · ${pk.sessions} sessions` }))
              : []
          }
        />
      ) : null}

      {tab === "settings" && isAdmin ? (
        <section className="admin-card" aria-label="Settings">
          <h2>Settings</h2>
          <ClientSettings clientId={client.id} role={client.role} coachId={client.coach_id} staff={staff} isSelf={client.id === viewer.id} />
          {client.email ? (
            <>
              <ResetPasswordButton clientId={client.id} />
              {removal ? (
                removal.reason ? (
                  <p className="admin-hint rc-wrap" style={{ fontSize: "13px" }}>{removal.reason}</p>
                ) : (
                  <RemoveClient clientId={client.id} email={client.email} name={name} />
                )
              ) : null}
            </>
          ) : (
            <div className="admin-settings" style={{ borderTop: "1px solid var(--bdr2)", paddingTop: "1rem" }}>
              {p.enquiries.length || p.coaching.sessions.length ? (
                <p className="admin-hint">This guest asked about coaching, so they can&rsquo;t be removed.</p>
              ) : (
                <RemoveGuestButton id={client.id} after="/coach/clients/guests" label="Remove this guest" />
              )}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true">◇</span>
      {text}
    </div>
  );
}

// Every audit, newest first; choose any two to compare area by area.
function AuditsTab({
  audits,
  areas,
  scoresFor,
  clientId,
  a,
  b,
}: {
  audits: { id: string; completed_at: string; total_score: number | null; sequence_number: number }[];
  areas: { id: string; name: string }[];
  scoresFor: (id: string) => ({ satisfaction_score: number } | null)[];
  clientId: string;
  a?: string;
  b?: string;
}) {
  const left = audits.find((x) => x.id === a) ?? audits[1] ?? audits[0];
  const right = audits.find((x) => x.id === b) ?? audits[0];
  const L = scoresFor(left.id);
  const R = scoresFor(right.id);
  const label = (x: (typeof audits)[number]) => `Audit ${x.sequence_number} · ${formatDate(x.completed_at)} · ${x.total_score ?? 0}/100`;

  return (
    <section aria-label="Audits">
      <ul className="past-goals">
        {audits.map((x) => (
          <li key={x.id}>
            <span className="past-status">{x.total_score ?? 0}</span>
            <div>
              <p>Audit {x.sequence_number}</p>
              <span>{formatDate(x.completed_at)}</span>
            </div>
          </li>
        ))}
      </ul>
      {audits.length > 1 ? (
        <>
          <div className="sec-head">Compare two audits</div>
          <form className="admin-filters" method="get">
            <input type="hidden" name="tab" value="audits" />
            <select name="a" defaultValue={left.id} aria-label="Earlier audit">
              {audits.map((x) => <option key={x.id} value={x.id}>{label(x)}</option>)}
            </select>
            <span className="cp-sub">with</span>
            <select name="b" defaultValue={right.id} aria-label="Later audit">
              {audits.map((x) => <option key={x.id} value={x.id}>{label(x)}</option>)}
            </select>
            <button type="submit" className="btn btn-g">Compare</button>
          </form>
          <div className="admin-table admin-generic" style={{ ["--cols" as string]: 4 }} role="table" aria-label={`Comparing audit ${left.sequence_number} and ${right.sequence_number}`}>
            <div className="admin-row head" role="row">
              <span role="columnheader">Area</span>
              <span role="columnheader">Audit {left.sequence_number}</span>
              <span role="columnheader">Audit {right.sequence_number}</span>
              <span role="columnheader">Change</span>
            </div>
            {areas.map((ar, i) => {
              const l = L[i]?.satisfaction_score ?? 0;
              const r = R[i]?.satisfaction_score ?? 0;
              return (
                <div key={ar.id} className="admin-row" role="row">
                  <span role="cell"><b>{ar.name}</b></span>
                  <span role="cell">{l}/10</span>
                  <span role="cell">{r}/10</span>
                  <span role="cell" className={r - l > 0 ? "cp-up" : r - l < 0 ? "cp-down" : undefined}>{r - l > 0 ? `+${r - l}` : r - l || "—"}</span>
                </div>
              );
            })}
          </div>
          <p className="cp-sub" style={{ marginTop: ".6rem" }}>
            <Link href={`/coach/clients/${clientId}?tab=audits`}>Reset</Link> · Scores are self-reported.
          </p>
        </>
      ) : null}
    </section>
  );
}
