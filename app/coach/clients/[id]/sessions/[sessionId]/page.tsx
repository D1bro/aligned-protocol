import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientProfile } from "@/lib/actions/admin";
import { formatDate } from "@/lib/audit-schedule";
import { formatSessionTime, toLocalParts } from "@/lib/time";
import { NoteEditor } from "../../NoteEditor";
import { SessionActions } from "../../SessionActions";
import { STATE_LABEL } from "../../SessionsTab";
import { SummaryWorkspace } from "./SummaryWorkspace";
import { EmailButton } from "../../EmailButton";
import { getMessageJobs } from "@/lib/actions/messages";
import { getTranscripts } from "@/lib/actions/summaries";

// AI drafting can take a while; allow up to 5 minutes (Vercel caps this per plan).
export const maxDuration = 300;

const STAGES = [
  ["prepare", "Prepare"],
  ["conversation", "In the conversation"],
  ["import", "Import and summarise"],
  ["review", "Review and share"],
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
  const snap = session.goal_snapshot;
  const auditUsed = p.audits.find((a) => a.id === session.audit_id) ?? null;
  const myNote = coaching.notes.find((n) => n.session_id === session.id && n.author_id === p.viewer.id) ?? null;
  const local = toLocalParts(session.scheduled_at, session.timezone);
  const summaries = coaching.summaries.filter((x) => x.session_id === session.id);
  const transcripts = stage === "import" || stage === "review" ? await getTranscripts(session.id) : [];
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
        <div className="desk-grid">
          <div className="desk-main">
            <section className="admin-card desk-open" aria-label="Opening question">
              <p className="au-detail-k">Opening question</p>
              <p className="desk-question">How are you, and what would make today useful?</p>
            </section>
            {previousBlock}
            <section className="admin-card" aria-labelledby="desk-goal-h">
              <h2 id="desk-goal-h">Their main goal</h2>
              {mainGoal ? (
                <dl className="ov-facts">
                  {str(mainGoal.focus_area) ? (<><dt>Area</dt><dd>{str(mainGoal.focus_area)}</dd></>) : null}
                  <dt>Goal</dt>
                  <dd>{str(mainGoal.goal_title)}</dd>
                  {str(mainGoal.motivation_text) ? (<><dt>Why it matters</dt><dd>{str(mainGoal.motivation_text)}</dd></>) : null}
                  {str(mainGoal.success_criteria) ? (<><dt>Done when</dt><dd>{str(mainGoal.success_criteria)}</dd></>) : null}
                </dl>
              ) : (
                <p className="admin-card-sub">No active goal.</p>
              )}
              {snap?.goal_title && mainGoal && snap.goal_title !== str(mainGoal.goal_title) ? (
                <p className="admin-card-sub">When this session was booked their goal was: &ldquo;{snap.goal_title}&rdquo;</p>
              ) : null}
              <p className="admin-card-sub">
                {auditUsed
                  ? `Audit used: ${formatDate(auditUsed.completed_at)} · ${auditUsed.total_score ?? 0}/100 (self-reported).`
                  : "No audit linked to this session."}{" "}
                <Link href={`/coach/clients/${client.id}?tab=goals`}>Goals and audit</Link>
              </p>
            </section>
            <section className="admin-card" aria-labelledby="desk-prep-h">
              <h2 id="desk-prep-h">Shared by {firstName}</h2>
              {prep.length ? (
                prep.map((x) => (
                  <div key={x.id as string} className="ov-prep">
                    <p className="au-detail-k">Shared {formatDate(x.shared_at as string)}</p>
                    <p>{str(x.content)}</p>
                  </div>
                ))
              ) : (
                <p className="admin-card-sub">No preparation shared.</p>
              )}
            </section>
          </div>
          <aside className="desk-side">
            <NoteEditor clientId={client.id} sessionId={session.id} initial={myNote} label="Your private note for this session" />
          </aside>
        </div>
      ) : null}

      {stage === "conversation" ? (
        <div className="desk-grid">
          <div className="desk-main">
            <section className="admin-card" aria-label="Working focus">
              <p className="au-detail-k">Working focus</p>
              <p className="desk-question">{str(mainGoal?.goal_title) ?? "No main goal set — follow what they bring."}</p>
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
          </div>
          <aside className="desk-side">
            <NoteEditor clientId={client.id} sessionId={session.id} initial={myNote} label="Your private note for this session" />
          </aside>
        </div>
      ) : null}

      {stage === "import" || stage === "review" ? (
        <SummaryWorkspace
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
        />
      ) : null}

      {stage === "review" && publishedHere && client.email ? (
        <section className="admin-card desk-email" aria-label="Email about the shared summary">
          <h2>Let {firstName} know</h2>
          <p className="admin-card-sub">
            Sharing puts the notes in {firstName}&rsquo;s member area. Emailing is a separate step: the email says the notes are
            ready and links to them. It doesn&rsquo;t include the notes themselves.
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
