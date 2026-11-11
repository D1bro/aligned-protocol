import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientProfile } from "@/lib/actions/admin";
import { formatDate } from "@/lib/audit-schedule";
import { formatSessionTime, toLocalParts } from "@/lib/time";
import { NoteEditor } from "../../NoteEditor";
import { SessionActions } from "../../SessionActions";
import { STATE_LABEL } from "../../SessionsTab";
import { ReflectionPanel, SummaryWorkspace } from "./SummaryWorkspace";
import { EmailButton } from "../../EmailButton";
import { getMessageJobs } from "@/lib/actions/messages";
import { getTranscripts } from "@/lib/actions/summaries";
import { getLifeAreas } from "@/lib/actions/audit";
import { getClientContext } from "@/lib/actions/coach-profile";
import { ClientContextEditor } from "@/components/coach/ClientContextEditor";
import { ClientSnapshot, type SnapshotProps } from "@/components/coach/ClientSnapshot";
import { ChartCalibration } from "@/components/coach/ChartCalibration";
import { getLatestCalibration, getSessionCalibration } from "@/lib/actions/calibration";
import { getClientIntention, getClientRecord } from "@/lib/actions/staff-profiles";
import { getClientContact } from "@/lib/actions/details";
import { localTimeLabel } from "@/lib/details";
import { SinceLastTime } from "@/components/coach/SinceLastTime";
import { StepReview } from "@/components/coach/StepReview";
import type { StepReview as StepReviewRow } from "@/lib/actions/step-review";
import type { ReviewContent } from "@/lib/next-step-review";
import { addDays, moveDays, whenLabel } from "@/lib/daily-log";
import { localDate } from "@/lib/time";

// AI drafting can take a while; allow up to 5 minutes (Vercel caps this per plan).
export const maxDuration = 300;

const STAGES = [
  ["prepare", "Prepare"],
  ["conversation", "In the conversation"],
  ["import", "Import and summarise"],
  ["review", "Review and share"],
  ["reflect", "Reflect"],
] as const;
type Stage = (typeof STAGES)[number][0];

const PROGRESS: Record<string, string> = { tried: "Tried it", partly: "Partly", done: "Done", not_yet: "Not yet" };
const PROMPTS = [
  "What's changed since we last spoke?",
  "What did you notice when you tried it?",
  "What got in the way, and what helped?",
  "What would make the next two weeks feel worthwhile?",
  "What's one thing you're choosing to do before we next meet?",
];
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

// The session desk: prepare, hold the conversation, summarise and share.
// Moving between stages never loses saved work; each stage reads the records.
export default async function SessionDeskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sessionId: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const { id, sessionId } = await params;
  const sp = await searchParams;
  const stage: Stage = (STAGES.map((s) => s[0]) as readonly string[]).includes(sp.stage ?? "") ? (sp.stage as Stage) : "prepare";
  const p = await getClientProfile(id);
  const { coaching, client } = p;
  const session = coaching.sessions.find((s) => s.id === sessionId);
  if (!session) notFound();

  const firstName = client.full_name?.trim().split(/\s+/)[0] || "them";
  const earlier = coaching.sessions
    .filter((s) => new Date(s.scheduled_at) < new Date(session.scheduled_at) && s.id !== session.id)
    .map((s) => s.id);
  // The last summary that was actually shared before this session.
  const lastShared =
    coaching.summaries.find((x) => x.status === "published" && x.session_id === session.previous_session_id) ??
    coaching.summaries.find((x) => x.status === "published" && earlier.includes(x.session_id as string)) ??
    null;
  const lastSharedSession = lastShared ? coaching.sessions.find((s) => s.id === lastShared.session_id) : null;
  const lastContent = (lastShared?.content ?? {}) as { focus?: string; summary?: string };
  const agreed = lastShared ? coaching.commitments.filter((c) => c.summary_id === lastShared.id) : [];
  const latestUpdate = (cid: unknown) => coaching.updates.find((u) => u.commitment_id === cid) ?? null;
  const prep = coaching.prepShares.filter(
    (x) =>
      x.session_id === session.id ||
      (!x.session_id && (!lastShared?.published_at || new Date(x.shared_at as string) > new Date(lastShared.published_at as string)))
  );
  const active = p.goals.filter((g) => g.status === "active").sort((a, b) => Number(b.goal_type === "primary") - Number(a.goal_type === "primary"));
  const mainGoal = active[0] ?? null;
  const goalMoves = mainGoal ? p.moves.filter((m) => m.goal_id === mainGoal.id) : [];
  const snap = session.goal_snapshot;
  const auditUsed = p.audits.find((a) => a.id === session.audit_id) ?? null;
  const myNote = coaching.notes.find((n) => n.session_id === session.id && n.author_id === p.viewer.id) ?? null;
  const local = toLocalParts(session.scheduled_at, session.timezone);
  const summaries = coaching.summaries.filter((x) => x.session_id === session.id);
  const transcripts = stage === "import" || stage === "review" || stage === "reflect" ? await getTranscripts(session.id) : [];
  const areas = stage === "review" ? (await getLifeAreas()).map((a) => ({ id: a.id, name: a.name })) : [];
  const clientContext = stage === "reflect" ? await getClientContext(client.id) : null;

  const publishedHere = summaries.find((x) => x.status === "published") ?? null;
  const jobs = stage === "review" && publishedHere ? await getMessageJobs(client.id) : [];
  const nextBookingSession =
    coaching.sessions
      .filter((x) => (x.state === "proposed" || x.state === "confirmed") && new Date(x.scheduled_at) > new Date(session.scheduled_at))
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null;
  const nextBooking = nextBookingSession
    ? `${formatSessionTime(nextBookingSession.scheduled_at, nextBookingSession.timezone)}${nextBookingSession.state === "proposed" ? " (proposed)" : ""}`
    : null;
  const sessionLabel = formatSessionTime(session.scheduled_at, session.timezone);

  // The client snapshot beside the conversation (Prepare and In the conversation).
  let snapshot: SnapshotProps | null = null;
  const calibrationHere = stage === "conversation" ? await getSessionCalibration(session.id) : null;
  const lifeAreas = stage === "prepare" || stage === "conversation" ? await getLifeAreas() : [];
  if (stage === "prepare" || stage === "conversation") {
    const [contact, record, context, latestCal, intention] = await Promise.all([
      getClientContact(client.id),
      getClientRecord(client.id),
      getClientContext(client.id),
      getLatestCalibration(client.id),
      getClientIntention(client.id),
    ]);
    const [latestAudit, previousAudit] = p.audits;
    const scoreOf = (auditId: string | undefined, areaId: string) =>
      auditId ? (p.responses.find((r) => r.audit_id === auditId && r.life_area_id === areaId) ?? null) : null;
    const plan = mainGoal ? p.plans.find((x) => x.id === mainGoal.clear_plan_id) ?? null : null;
    const goalChecks = mainGoal ? p.checkIns.filter((c) => c.goal_id === mainGoal.id) : [];
    const lastMonthly = goalChecks.find((c) => c.kind !== "weekly" && typeof c.area_score === "number");
    const lastWeekly = goalChecks.find((c) => c.kind === "weekly" && str(c.next_commitment));
    const planArea = plan ? lifeAreas.find((a) => a.id === plan.life_area_id) ?? null : null;
    const baseline = plan && planArea ? scoreOf(plan.audit_id as string, planArea.id)?.satisfaction_score ?? null : null;
    snapshot = {
      clientId: client.id,
      firstName,
      glance: {
        preferredName: contact?.preferred_name ?? null,
        localTime: contact?.timezone ? localTimeLabel(contact.timezone) : null,
        status: record.available ? record.status : null,
        since: formatDate(record.startedOn || client.created_at),
        held: coaching.sessions.filter((x) => x.state === "held").length,
        nextBooking,
      },
      context: { available: context.available, notes: context.notes },
      map: latestAudit
        ? {
            auditDate: formatDate(latestAudit.completed_at),
            wholeLife: latestAudit.total_score,
            calibratedOn: latestCal ? formatDate(latestCal.sharedAt ?? latestCal.createdAt) : null,
            areas: lifeAreas.map((a) => {
              const now = scoreOf(latestAudit.id, a.id);
              const cal = latestCal?.areas.find((x) => x.life_area_id === a.id);
              return {
                name: a.name,
                now: now?.satisfaction_score ?? null,
                before: scoreOf(previousAudit?.id, a.id)?.satisfaction_score ?? null,
                agreed: cal?.agreed ?? null,
                note: now?.note ?? null,
                focus: cal?.focus ?? false,
              };
            }),
          }
        : null,
      plan: mainGoal
        ? {
            goal: str(mainGoal.goal_title) ?? "Their goal",
            why: str(plan?.why_it_matters) ?? str(mainGoal.motivation_text),
            area: planArea?.name ?? null,
            now: (lastMonthly?.area_score as number | undefined) ?? (mainGoal.start_score as number | null) ?? baseline,
            target: (mainGoal.aim_score as number | null) ?? (plan?.step_up_target as number | null | undefined) ?? null,
            focusThisWeek: str(lastWeekly?.next_commitment),
            intention,
          }
        : null,
      otherGoals: active.slice(1).map((g) => str(g.goal_title) ?? "A goal"),
    };
  }
  // Since last time and the Next Step review (migration 0032): the member's
  // daily log since the last session held, and the sharper version agreed.
  const lastHeld = coaching.sessions
    .filter((x) => x.state === "held" && x.id !== session.id && new Date(x.scheduled_at) < new Date(session.scheduled_at))
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0];
  const sinceDay = lastHeld ? localDate(lastHeld.scheduled_at) : addDays(localDate(new Date()), -13);
  const mainId = (mainGoal?.id as string | undefined) ?? null;
  const reviewRow = mainId ? p.reviews.find((r) => r.goal_id === mainId) ?? null : null;
  const stepReview: StepReviewRow | null = reviewRow
    ? {
        id: reviewRow.id as string,
        goalId: reviewRow.goal_id as string,
        content: (reviewRow.content as ReviewContent) ?? {},
        sentAt: (reviewRow.sent_at as string | null) ?? null,
        answer: (reviewRow.answer as string | null) ?? null,
        answeredAt: (reviewRow.answered_at as string | null) ?? null,
        updatedAt: reviewRow.updated_at as string,
      }
    : null;
  const recentShared = coaching.summaries.filter((x) => x.status === "published").slice(0, 2);
  const workedBefore = [
    ...new Set(
      recentShared.flatMap((x) => {
        const ins = (x.content as { insights?: unknown } | null)?.insights;
        return Array.isArray(ins) ? ins.filter((i): i is string => typeof i === "string" && !!i.trim()) : [];
      })
    ),
  ].slice(0, 6);
  const olderOpen = coaching.commitments
    .filter((c) => c.owner === "client" && c.status === "open" && c.summary_id !== lastShared?.id)
    .map((c) => ({ id: c.id as string, body: str(c.body) ?? "", due_date: (c.due_date as string | null) ?? null, created_at: c.created_at as string }));
  const goalCheckIns = mainId
    ? p.checkIns
        .filter((c) => c.goal_id === mainId && c.kind === "weekly" && localDate(c.created_at as string) >= sinceDay)
        .map((c) => ({ created_at: c.created_at as string, closer: (c.closer as string | null) ?? null, helped: (c.helped as string | null) ?? null }))
    : [];
  const latestAuditForCal = p.audits[0] ?? null;

  const previousBlock = (
    <section className="admin-card" aria-labelledby="desk-last-h">
      <h2 id="desk-last-h">Last time</h2>
      {lastShared ? (
        <>
          <p className="admin-card-sub">
            Shared summary from {lastSharedSession ? formatSessionTime(lastSharedSession.scheduled_at, lastSharedSession.timezone) : "an earlier session"}
          </p>
          {lastContent.focus ? <p><b>Focus:</b> {lastContent.focus}</p> : null}
          {lastContent.summary ? <p className="ov-summary">{lastContent.summary}</p> : null}
        </>
      ) : (
        <p className="admin-card-sub">No earlier summary was shared. This may be your first session together.</p>
      )}
      <h3 className="desk-h3">What was agreed</h3>
      {agreed.length ? (
        <ul className="ov-commit">
          {agreed.map((c) => {
            const u = latestUpdate(c.id);
            return (
              <li key={c.id as string}>
                <span className={`ov-owner ${c.owner}`}>{c.owner === "client" ? firstName : "You"}</span>
                <div>
                  <p>{str(c.body)}</p>
                  <em>
                    {c.due_date ? `Due ${formatDate(c.due_date as string)} · ` : ""}
                    {c.owner === "client"
                      ? u
                        ? `${PROGRESS[u.progress as string] ?? u.progress}, ${formatDate(u.created_at as string)}${str(u.note) ? ` — “${str(u.note)}”` : ""}${u.support_requested ? " · asked for support" : ""}`
                        : "No update shared"
                      : c.status === "done"
                        ? "Done"
                        : "Open"}
                  </em>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="admin-card-sub">Nothing was agreed in a shared summary.</p>
      )}
    </section>
  );

  return (
    <div className="page admin-page desk">
      <Link href={`/coach/clients/${client.id}?tab=sessions`} className="tb-back" style={{ marginBottom: "1rem", display: "inline-flex" }}>
        ← {client.full_name || "Client"} · sessions
      </Link>
      <header className="desk-head">
        <div>
          <div className="eyebrow"><span className="eydot" /> Session with {client.full_name || "client"}</div>
          <h1>{formatSessionTime(session.scheduled_at, session.timezone)}</h1>
          <p className="cp-sub">
            <span className={`cs-state ${session.state}`}>{STATE_LABEL[session.state]}</span> · {session.duration_minutes} minutes
            {session.location ? ` · ${session.location}` : ""}
          </p>
        </div>
        <SessionActions sessionId={session.id} state={session.state} localDate={local.date} localTime={local.time} />
      </header>

      <nav className="admin-tabs cp-tabs" aria-label="Session stages">
        {STAGES.map(([k, label], i) => (
          <Link key={k} href={`/coach/clients/${client.id}/sessions/${session.id}?stage=${k}`} aria-current={stage === k ? "page" : undefined}>
            {i + 1}. {label}
          </Link>
        ))}
      </nav>

      {stage === "prepare" ? (
        <>
        <div className="desk-grid">
          <div className="desk-main">
            <section className="admin-card desk-open" aria-label="Opening question">
              <p className="au-detail-k">Opening question</p>
              <p className="desk-question">How are you, and what would make today useful?</p>
            </section>
            {previousBlock}
            <section className="admin-card" aria-labelledby="desk-goal-h">
              <h2 id="desk-goal-h">Their Next Step</h2>
              {mainGoal ? (
                <dl className="ov-facts">
                  {str(mainGoal.focus_area) ? (<><dt>Area</dt><dd>{str(mainGoal.focus_area)}{mainGoal.start_score ? ` · ${mainGoal.start_score}${mainGoal.aim_score && Number(mainGoal.aim_score) > Number(mainGoal.start_score) ? ` → aiming for ${mainGoal.aim_score}` : ""}` : ""}</dd></>) : null}
                  <dt>Next Step</dt>
                  <dd>{str(mainGoal.goal_title)}</dd>
                  {str(mainGoal.motivation_text) ? (<><dt>Why this one</dt><dd>{str(mainGoal.motivation_text)}</dd></>) : null}
                  {str(mainGoal.in_the_way) ? (<><dt>What&rsquo;s in the way</dt><dd>{str(mainGoal.in_the_way)}</dd></>) : null}
                  {str(mainGoal.success_criteria) ? (<><dt>How they&rsquo;ll know</dt><dd>{str(mainGoal.success_criteria)}</dd></>) : null}
                  {goalMoves.length ? (
                    <>
                      <dt>Moves</dt>
                      <dd>
                        {goalMoves.slice(0, 5).map((m) => {
                          const days = moveDays(m.when_text);
                          return (
                            <span key={m.id} className="desk-move">
                              {days.length ? "↻" : m.done_at ? "✓" : "○"} {m.body}
                              {m.when_text?.trim() ? ` · ${whenLabel(m.when_text)}` : ""}
                            </span>
                          );
                        })}
                      </dd>
                    </>
                  ) : null}
                </dl>
              ) : (
                <p className="admin-card-sub">No Next Step under way.</p>
              )}
              {snap?.goal_title && mainGoal && snap.goal_title !== str(mainGoal.goal_title) ? (
                <p className="admin-card-sub">When this session was booked their Next Step was: &ldquo;{snap.goal_title}&rdquo;</p>
              ) : null}
              <p className="admin-card-sub">
                {auditUsed
                  ? `Audit used: ${formatDate(auditUsed.completed_at)} · ${auditUsed.total_score ?? 0}/100 (self-reported).`
                  : "No audit linked to this session."}{" "}
                <Link href={`/coach/clients/${client.id}?tab=goals`}>Goals and audit</Link>
              </p>
            </section>
            {mainGoal ? (
              <SinceLastTime
                clientId={client.id}
                firstName={firstName}
                goal={{
                  id: mainGoal.id as string,
                  name: str(mainGoal.step_name) ?? str(mainGoal.goal_title) ?? "Their Next Step",
                  set_at: (mainGoal.set_at as string | null) ?? null,
                  count_target: (mainGoal.count_target as number | null) ?? null,
                  count_move_id: (mainGoal.count_move_id as string | null) ?? null,
                }}
                moves={goalMoves.map((m) => ({ ...m, goal_id: m.goal_id }))}
                ticks={p.ticks}
                since={sinceDay}
                checkIns={goalCheckIns}
                olderOpen={olderOpen}
                updates={coaching.updates as { commitment_id: string; progress: string; created_at: string }[]}
              />
            ) : null}
            <section className="admin-card" aria-labelledby="desk-prep-h">
              <h2 id="desk-prep-h">Shared by {firstName}</h2>
              {prep.length ? (
                prep.map((x) => (
                  <div key={x.id as string} className="ov-prep">
                    <p className="au-detail-k">{str(x.title) ? `${str(x.title)} · shared` : "Shared"} {formatDate(x.shared_at as string)}</p>
                    <p>{str(x.content)}</p>
                  </div>
                ))
              ) : (
                <p className="admin-card-sub">No preparation shared.</p>
              )}
            </section>
          </div>
          <aside className="desk-side">
            {snapshot ? <ClientSnapshot {...snapshot} /> : null}
            <NoteEditor clientId={client.id} sessionId={session.id} initial={myNote} label="Your private note for this session" />
          </aside>
        </div>
        {mainGoal ? (
          <StepReview
            clientId={client.id}
            firstName={firstName}
            goalId={mainGoal.id as string}
            current={{
              title: str(mainGoal.goal_title) ?? "",
              name: str(mainGoal.step_name),
              why: str(mainGoal.motivation_text),
              done: str(mainGoal.success_criteria),
              countTarget: (mainGoal.count_target as number | null) ?? null,
              countMoveId: (mainGoal.count_move_id as string | null) ?? null,
              start: (mainGoal.start_score as number | null) ?? null,
              aim: (mainGoal.aim_score as number | null) ?? null,
              inTheWay: str(mainGoal.in_the_way),
              moves: goalMoves.map((m) => ({ id: m.id, body: m.body, when_text: m.when_text })),
            }}
            review={stepReview}
            worked={workedBefore}
            aiAvailable={Boolean(process.env.ANTHROPIC_API_KEY)}
          />
        ) : null}
        </>
      ) : null}

      {stage === "conversation" ? (
        <div className="desk-grid">
          <div className="desk-main">
            <section className="admin-card" aria-label="Working focus">
              <p className="au-detail-k">Working focus</p>
              <p className="desk-question">{str(mainGoal?.goal_title) ?? "No Next Step set — follow what they bring."}</p>
            </section>
            {previousBlock}
            <section className="admin-card" aria-label="Points to confirm">
              <h2>Points to confirm together</h2>
              <SummaryWorkspace
                mode="points"
                clientId={client.id}
                sessionId={session.id}
                summaries={summaries}
                goals={active.map((g) => ({ id: g.id as string, title: str(g.goal_title) ?? "Goal" }))}
                firstName={firstName}
                aiAvailable={Boolean(process.env.ANTHROPIC_API_KEY)}
                transcripts={[]}
                sessionLabel={sessionLabel}
                nextBooking={nextBooking}
              />
            </section>
            <details className="plan-more">
              <summary>Optional prompts <span>Use any, or none</span></summary>
              <ul className="desk-prompts">
                {PROMPTS.map((q) => <li key={q}>{q}</li>)}
              </ul>
            </details>
            {latestAuditForCal && calibrationHere?.available ? (
              <details className="plan-more cal-wrap" open={!!calibrationHere.calibration}>
                <summary>Take your chart further <span>Go through all ten areas together</span></summary>
                <ChartCalibration
                  sessionId={session.id}
                  clientId={client.id}
                  firstName={firstName}
                  auditId={latestAuditForCal.id}
                  auditDate={formatDate(latestAuditForCal.completed_at)}
                  rows={lifeAreas.map((a) => {
                    const r = p.responses.find((x) => x.audit_id === latestAuditForCal.id && x.life_area_id === a.id);
                    return { id: a.id, name: a.name, alone: r?.satisfaction_score ?? null, note: r?.note ?? null };
                  })}
                  initial={calibrationHere.calibration}
                />
              </details>
            ) : null}
          </div>
          <aside className="desk-side">
            {snapshot ? <ClientSnapshot {...snapshot} /> : null}
            <NoteEditor clientId={client.id} sessionId={session.id} initial={myNote} label="Your private note for this session" />
          </aside>
        </div>
      ) : null}

      {stage === "import" || stage === "review" ? (
        // Keyed by stage, so moving to Review and share always starts from the
        // saved draft (an AI draft made in step 3 included), never a copy
        // held over from the previous step.
        <SummaryWorkspace
          key={stage}
          mode={stage}
          clientId={client.id}
          sessionId={session.id}
          summaries={summaries}
          goals={active.map((g) => ({ id: g.id as string, title: str(g.goal_title) ?? "Goal" }))}
          firstName={firstName}
          aiAvailable={Boolean(process.env.ANTHROPIC_API_KEY)}
          transcripts={transcripts}
          sessionLabel={sessionLabel}
          nextBooking={nextBooking}
          nextSessionId={nextBookingSession?.id ?? null}
          areas={areas}
          location={session.location}
          durationMinutes={session.duration_minutes}
        />
      ) : null}

      {stage === "reflect" ? (
        <div className="desk-grid">
          <div className="desk-main">
            {transcripts.length ? (
              <ReflectionPanel
                transcripts={transcripts}
                aiAvailable={Boolean(process.env.ANTHROPIC_API_KEY)}
                clientId={client.id}
                firstName={firstName}
                nextSessionId={nextBookingSession?.id ?? null}
              />
            ) : (
              <section className="admin-card">
                <h2>Reflect</h2>
                <p className="admin-card-sub">
                  Add a transcript in <Link href="?stage=import">3. Import and summarise</Link> first; the reflection is built from it.
                </p>
              </section>
            )}
          </div>
          <aside className="desk-side">
            {clientContext?.available ? <ClientContextEditor key={clientContext.notes} clientId={client.id} firstName={firstName} initial={clientContext.notes} /> : null}
            <NoteEditor clientId={client.id} sessionId={session.id} initial={myNote} label="Your private note for this session" />
          </aside>
        </div>
      ) : null}

      {stage === "review" && publishedHere && client.email ? (
        <section className="admin-card desk-email" aria-label="Email about the shared summary">
          <h2>Let {firstName} know</h2>
          <p className="admin-card-sub">
            Sharing puts the notes in {firstName}&rsquo;s member area. Emailing is a separate step: by default the email says the
            notes are ready and links to them. Tick &ldquo;Include the summary&rdquo; to put the shared wording in the email too.
            Your private notes, reflection and the transcript are never emailed.
          </p>
          <EmailButton
            kind="summary_shared"
            refId={publishedHere.id as string}
            label={`Email ${firstName} that the notes are ready`}
            last={jobs.find((j) => j.dedupe_key.startsWith(`summary:${publishedHere.id}`)) ?? null}
          />
        </section>
      ) : null}
    </div>
  );
}
