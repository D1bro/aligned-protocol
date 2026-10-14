"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  approveDraft,
  generateDraft,
  getOrCreateDraft,
  importTranscript,
  publishSummary,
  saveDraft,
  type Summary,
  type SummaryContent,
  type Transcript,
} from "@/lib/actions/summaries";
import { EMPTY_CONTENT } from "@/lib/summary-content";

type Mode = "points" | "import" | "review";

const fill = (c: Partial<SummaryContent> | undefined): SummaryContent => ({
  ...EMPTY_CONTENT,
  ...(c ?? {}),
  next_meeting: { text: c?.next_meeting?.text ?? "" },
});

// The summary side of the session desk: points to confirm during the
// conversation, transcript import, and the reviewed summary that is shared.
export function SummaryWorkspace({
  mode,
  clientId,
  sessionId,
  sessionLabel,
  summaries,
  transcripts,
  goals,
  firstName,
  aiAvailable,
  nextBooking,
}: {
  mode: Mode;
  clientId: string;
  sessionId: string;
  sessionLabel: string;
  summaries: Record<string, unknown>[];
  transcripts: Transcript[];
  goals: { id: string; title: string }[];
  firstName: string;
  aiAvailable: boolean;
  nextBooking: string | null;
}) {
  const router = useRouter();
  const typed = summaries as unknown as Summary[];
  const [draft, setDraft] = useState<Summary | null>(typed.find((s) => s.status === "draft" || s.status === "approved") ?? null);
  const published = typed.find((s) => s.status === "published") ?? null;
  const [content, setContent] = useState<SummaryContent>(fill(draft?.content ?? published?.content));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const edit = (patch: Partial<SummaryContent>) => {
    setContent((c) => ({ ...c, ...patch }));
    setDirty(true);
    setNote(null);
  };

  async function ensureDraft(): Promise<Summary | null> {
    if (draft) return draft;
    const r = await getOrCreateDraft(sessionId);
    if (!r.ok) {
      setNote({ ok: false, text: r.message });
      return null;
    }
    setDraft(r.summary);
    return r.summary;
  }

  async function save(): Promise<Summary | null> {
    setBusy("save");
    const d = await ensureDraft();
    if (!d) return setBusy(null), null;
    const r = await saveDraft({ summaryId: d.id, content, expectedVersion: d.version });
    setBusy(null);
    if (!r.ok) {
      setNote({ ok: false, text: r.message });
      return null;
    }
    setDraft(r.summary);
    setDirty(false);
    setNote({ ok: true, text: "Draft saved." });
    router.refresh();
    return r.summary;
  }

  // ---- Points to confirm (during the conversation) ----
  if (mode === "points") {
    return (
      <div className="sw">
        <ListEditor
          items={content.points}
          onChange={(points) => edit({ points })}
          placeholder="Something to confirm together before you finish"
          addLabel="Add a point"
        />
        <div className="cs-actions">
          <button type="button" className="btn btn-g" disabled={!dirty || busy !== null} onClick={save}>
            {busy === "save" ? "Saving…" : "Save points"}
          </button>
          <Status dirty={dirty} note={note} />
        </div>
        <p className="admin-card-sub">These go into the working draft, ready to turn into agreed actions when you summarise.</p>
      </div>
    );
  }

  // ---- Import and summarise ----
  if (mode === "import") {
    return <ImportPanel {...{ sessionId, sessionLabel, firstName, transcripts, aiAvailable, draft, router }} />;
  }

  // ---- Review and share ----
  const flags = transcripts.find((t) => t.ai_status === "done")?.ai_output;

  async function approve() {
    if (dirty) return setNote({ ok: false, text: "Save your changes first, then approve." });
    if (!draft) return;
    setBusy("approve");
    const r = await approveDraft(draft.id, draft.version);
    setBusy(null);
    if (!r.ok) return setNote({ ok: false, text: r.message });
    setDraft(r.summary);
    setNote({ ok: true, text: "Approved. Share it when you're ready." });
    router.refresh();
  }

  async function publish() {
    if (!draft || draft.status !== "approved" || dirty) return;
    if (!window.confirm(`Share this summary with ${firstName}? They'll see exactly the preview on the right in their Coaching page.`)) return;
    setBusy("publish");
    const r = await publishSummary(draft.id, draft.version);
    setBusy(null);
    if (!r.ok) return setNote({ ok: false, text: r.message });
    setDraft(null);
    setNote({ ok: true, text: `Shared with ${firstName} (revision ${r.revision}).` });
    router.refresh();
  }

  if (!draft && published) {
    return (
      <div className="sw-review">
        <div>
          <p className="cp-sub">
            Shared with {firstName} · revision {published.revision}
            {published.published_at ? ` · ${new Date(published.published_at).toLocaleString("en-GB", { timeZone: "Europe/London" })}` : ""}
          </p>
          <p className="admin-card-sub">The shared version doesn&rsquo;t change. To correct or add to it, edit a new draft and share again.</p>
          <button
            type="button"
            className="btn btn-g"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("new");
              const d = await ensureDraft();
              setBusy(null);
              if (d) {
                setContent(fill(d.content));
                router.refresh();
              }
            }}
          >
            {busy === "new" ? "Starting…" : "Edit a new draft"}
          </button>
          {note ? <p className={note.ok ? "admin-ok" : "clear-err"}>{note.text}</p> : null}
        </div>
        <Preview content={fill(published.content)} firstName={firstName} goals={goals} nextBooking={nextBooking} />
      </div>
    );
  }

  return (
    <div className="sw-review">
      <div className="sw-editor">
        <p className="cp-sub">
          {draft ? `Revision ${draft.revision} · ${draft.status === "approved" ? "Approved — not shared yet" : "Draft"}` : "No draft yet"}
          {draft?.generated_by === "ai" ? " · started from an AI draft" : ""}
          {published ? ` · revision ${published.revision} is what ${firstName} sees now` : ""}
        </p>
        {flags?.review_flags?.length ? (
          <div className="sw-flags">
            <p className="au-detail-k">Check before sharing (only you see this)</p>
            <ul>{flags.review_flags.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </div>
        ) : null}

        <label className="sw-field">
          <span>Focus</span>
          <input type="text" value={content.focus} onChange={(e) => edit({ focus: e.target.value })} placeholder="What this session was about" />
        </label>
        <label className="sw-field">
          <span>Summary (written to {firstName})</span>
          <textarea rows={6} value={content.summary} onChange={(e) => edit({ summary: e.target.value })} />
        </label>
        <div className="sw-field">
          <span>What you noticed</span>
          <ListEditor items={content.insights} onChange={(insights) => edit({ insights })} placeholder="An insight, in their words" addLabel="Add an insight" />
        </div>

        <div className="sw-field">
          <span>{firstName}&rsquo;s next steps</span>
          {content.client_actions.map((a, i) => (
            <div key={i} className="sw-action">
              <input
                type="text"
                value={a.text}
                aria-label="Action"
                onChange={(e) => edit({ client_actions: content.client_actions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
              />
              <input
                type="date"
                value={a.due_date}
                aria-label="By when (optional)"
                onChange={(e) => edit({ client_actions: content.client_actions.map((x, j) => (j === i ? { ...x, due_date: e.target.value } : x)) })}
              />
              <select
                value={a.goal_id}
                aria-label="Linked goal (optional)"
                onChange={(e) => edit({ client_actions: content.client_actions.map((x, j) => (j === i ? { ...x, goal_id: e.target.value } : x)) })}
              >
                <option value="">No goal link</option>
                {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
              <button type="button" className="au-text-link as-btn" onClick={() => edit({ client_actions: content.client_actions.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <button type="button" className="au-text-link as-btn" onClick={() => edit({ client_actions: [...content.client_actions, { text: "", due_date: "", goal_id: "" }] })}>
            + Add a next step
          </button>
        </div>

        <div className="sw-field">
          <span>Your follow-ups</span>
          {content.coach_actions.map((a, i) => (
            <div key={i} className="sw-action">
              <input
                type="text"
                value={a.text}
                aria-label="Follow-up"
                onChange={(e) => edit({ coach_actions: content.coach_actions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
              />
              <input
                type="date"
                value={a.due_date}
                aria-label="By when (optional)"
                onChange={(e) => edit({ coach_actions: content.coach_actions.map((x, j) => (j === i ? { ...x, due_date: e.target.value } : x)) })}
              />
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={a.visible}
                  onChange={(e) => edit({ coach_actions: content.coach_actions.map((x, j) => (j === i ? { ...x, visible: e.target.checked } : x)) })}
                />
                {firstName} sees it
              </label>
              <button type="button" className="au-text-link as-btn" onClick={() => edit({ coach_actions: content.coach_actions.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <button type="button" className="au-text-link as-btn" onClick={() => edit({ coach_actions: [...content.coach_actions, { text: "", due_date: "", visible: true }] })}>
            + Add a follow-up
          </button>
        </div>

        <div className="sw-field">
          <span>Resources (optional)</span>
          {content.resources.map((r, i) => (
            <div key={i} className="sw-action">
              <input type="text" value={r.title} placeholder="Title" aria-label="Resource title" onChange={(e) => edit({ resources: content.resources.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
              <input type="url" value={r.url} placeholder="https://…" aria-label="Resource link" onChange={(e) => edit({ resources: content.resources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
              <button type="button" className="au-text-link as-btn" onClick={() => edit({ resources: content.resources.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <button type="button" className="au-text-link as-btn" onClick={() => edit({ resources: [...content.resources, { title: "", url: "" }] })}>+ Add a resource</button>
        </div>

        <label className="sw-field">
          <span>Next meeting, as discussed</span>
          <input type="text" value={content.next_meeting.text} onChange={(e) => edit({ next_meeting: { text: e.target.value } })} placeholder="e.g. Same time in two weeks" />
          <em>
            A time mentioned in conversation is only a proposal. {nextBooking ? `Booked: ${nextBooking}.` : "Nothing booked yet —"}{" "}
            {!nextBooking ? <Link href={`/coach/clients/${clientId}?tab=sessions`}>book it in Sessions</Link> : null}
          </em>
        </label>

        <div className="cs-actions sw-buttons">
          <button type="button" className="btn btn-g" disabled={!dirty || busy !== null} onClick={save}>
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>
          <button type="button" className="btn btn-g" disabled={dirty || !draft || draft.status !== "draft" || busy !== null} onClick={approve}>
            {busy === "approve" ? "Approving…" : "Approve wording"}
          </button>
          <button type="button" className="btn btn-p" disabled={dirty || draft?.status !== "approved" || busy !== null} onClick={publish}>
            {busy === "publish" ? "Sharing…" : `Share with ${firstName}`}
          </button>
          <Status dirty={dirty} note={note} />
        </div>
        <p className="admin-card-sub">
          Sharing puts it in {firstName}&rsquo;s Coaching page. Sending an email about it is a separate step, available once
          email is set up. Private notes and transcripts are never included.
        </p>
      </div>
      <Preview content={content} firstName={firstName} goals={goals} nextBooking={nextBooking} />
    </div>
  );
}

function Status({ dirty, note }: { dirty: boolean; note: { ok: boolean; text: string } | null }) {
  return (
    <span className={note && !note.ok ? "clear-err" : "note-status"} aria-live="polite">
      {note ? note.text : dirty ? "Unsaved changes" : ""}
    </span>
  );
}

function ListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  return (
    <div className="sw-list">
      {items.map((it, i) => (
        <div key={i} className="sw-action">
          <input type="text" value={it} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="au-text-link as-btn" onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <button type="button" className="au-text-link as-btn" onClick={() => onChange([...items, ""])}>+ {addLabel}</button>
    </div>
  );
}

// Exactly what the member will see (mirrors the member's Coaching page).
function Preview({
  content,
  firstName,
  goals,
  nextBooking,
}: {
  content: SummaryContent;
  firstName: string;
  goals: { id: string; title: string }[];
  nextBooking: string | null;
}) {
  const fmt = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : "");
  const visibleCoach = content.coach_actions.filter((a) => a.visible && a.text.trim());
  return (
    <aside className="sw-preview" aria-label={`What ${firstName} will see`}>
      <p className="au-detail-k">What {firstName} will see</p>
      <h3>{content.focus || "Our session"}</h3>
      {content.summary ? <p className="sw-p">{content.summary}</p> : <p className="admin-card-sub">No summary written yet.</p>}
      {content.insights.filter(Boolean).length ? (
        <>
          <h4>What you noticed</h4>
          <ul>{content.insights.filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ul>
        </>
      ) : null}
      {content.client_actions.filter((a) => a.text.trim()).length ? (
        <>
          <h4>Your next steps</h4>
          <ul>
            {content.client_actions.filter((a) => a.text.trim()).map((a, i) => (
              <li key={i}>
                {a.text}
                {a.due_date ? <em> · by {fmt(a.due_date)}</em> : null}
                {a.goal_id ? <em> · for “{goals.find((g) => g.id === a.goal_id)?.title}”</em> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {visibleCoach.length ? (
        <>
          <h4>What I&rsquo;ll do</h4>
          <ul>{visibleCoach.map((a, i) => <li key={i}>{a.text}{a.due_date ? <em> · by {fmt(a.due_date)}</em> : null}</li>)}</ul>
        </>
      ) : null}
      {content.resources.filter((r) => r.title.trim()).length ? (
        <>
          <h4>Resources</h4>
          <ul>{content.resources.filter((r) => r.title.trim()).map((r, i) => <li key={i}>{r.url ? <a href={r.url}>{r.title}</a> : r.title}</li>)}</ul>
        </>
      ) : null}
      <h4>Next meeting</h4>
      <p className="sw-p">
        {nextBooking ? `Booked: ${nextBooking}` : content.next_meeting.text ? `Proposed: ${content.next_meeting.text} (not booked yet)` : "To be arranged"}
      </p>
    </aside>
  );
}

function ImportPanel({
  sessionId,
  sessionLabel,
  firstName,
  transcripts,
  aiAvailable,
  draft,
  router,
}: {
  sessionId: string;
  sessionLabel: string;
  firstName: string;
  transcripts: Transcript[];
  aiAvailable: boolean;
  draft: Summary | null;
  router: ReturnType<typeof useRouter>;
}) {
  const [source, setSource] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [speakers, setSpeakers] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(f: File | undefined) {
    setNote(null);
    if (!f) return;
    if (!/\.(txt|vtt|srt|md)$/i.test(f.name)) return setNote({ ok: false, text: "Choose a text transcript: .txt, .vtt, .srt or .md." });
    if (f.size > 1_000_000) return setNote({ ok: false, text: "That file is over 1 MB. Paste the text instead, or trim it." });
    setText(await f.text());
    setFileName(f.name);
  }

  async function submit() {
    setBusy("import");
    setNote(null);
    const r = await importTranscript({ sessionId, source, fileName: source === "upload" ? fileName : null, text, transcriptDate: date, speakerMap: speakers, consent });
    setBusy(null);
    if (!r.ok) return setNote({ ok: false, text: r.message });
    setNote({ ok: true, text: r.duplicate ? "This transcript was already imported for this session — nothing new was saved." : "Transcript saved." });
    setText("");
    setFileName(null);
    router.refresh();
  }

  async function draftWithAi(t: Transcript) {
    const hasDraft = Boolean(draft && (draft.content.summary || draft.content.focus));
    if (hasDraft && !window.confirm("Replace the current draft's wording with a new AI draft?")) return;
    setBusy(t.id);
    setNote(null);
    const r = await generateDraft({ transcriptId: t.id, replace: hasDraft });
    setBusy(null);
    if (!r.ok) return setNote({ ok: false, text: r.message });
    setNote({ ok: true, text: "Draft ready. Review it in step 4 before sharing." });
    router.refresh();
  }

  return (
    <div className="sw-import">
      <section className="admin-card">
        <h2>Add a transcript</h2>
        <p className="plan-note">Saving to: <b>{firstName}</b> · session {sessionLabel}</p>
        <div className="admin-tabs" role="group" aria-label="Transcript source">
          <button type="button" aria-pressed={source === "paste"} className={source === "paste" ? "on" : undefined} onClick={() => setSource("paste")}>Paste text</button>
          <button type="button" aria-pressed={source === "upload"} className={source === "upload" ? "on" : undefined} onClick={() => setSource("upload")}>Upload a file</button>
        </div>
        {source === "upload" ? (
          <label className="sw-field">
            <span>Transcript file (.txt, .vtt, .srt, .md · up to 1 MB)</span>
            <input type="file" accept=".txt,.vtt,.srt,.md,text/plain,text/vtt" onChange={(e) => onFile(e.target.files?.[0])} />
            {fileName ? <em>{fileName} · {text.length.toLocaleString()} characters</em> : null}
          </label>
        ) : (
          <label className="sw-field">
            <span>Transcript</span>
            <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the transcript or your recording tool's notes" />
          </label>
        )}
        <div className="cs-grid">
          <label className="sw-field">
            <span>Date of the conversation</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="sw-field">
            <span>Who is who (optional)</span>
            <input type="text" value={speakers} onChange={(e) => setSpeakers(e.target.value)} placeholder={`Speaker 1 = you, Speaker 2 = ${firstName}`} />
          </label>
        </div>
        <label className="admin-check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {firstName} agreed to this conversation being
          recorded or transcribed.
        </label>
        <div className="cs-actions">
          <button type="button" className="btn btn-p" disabled={busy !== null || !text.trim() || !consent} onClick={submit}>
            {busy === "import" ? "Saving…" : "Save transcript"}
          </button>
          {note ? <span className={note.ok ? "admin-ok" : "clear-err"} role="status">{note.text}</span> : null}
        </div>
        <p className="admin-card-sub">Transcripts are private to you and {firstName}&rsquo;s assigned coach. They&rsquo;re never shared.</p>
      </section>

      <section className="admin-card">
        <h2>Transcripts for this session</h2>
        {!aiAvailable ? (
          <p className="plan-note">
            Automatic drafting isn&rsquo;t set up (it needs an Anthropic API key). Write the summary yourself in step 4 —
            everything else works the same.
          </p>
        ) : null}
        {transcripts.length ? (
          <ul className="cs-list">
            {transcripts.map((t) => (
              <li key={t.id} className="cs-row">
                <div className="cs-row-head">
                  <b>{t.file_name ?? "Pasted text"}</b>
                  <span className="cp-sub">
                    {t.transcript_date ? new Date(`${t.transcript_date}T12:00:00Z`).toLocaleDateString("en-GB") : "Date not given"} ·{" "}
                    {t.length.toLocaleString()} characters{t.speaker_map?.text ? ` · ${t.speaker_map.text}` : " · speakers not mapped"}
                  </span>
                </div>
                {t.ai_status === "processing" ? <p className="note-status">Drafting… this can take a minute.</p> : null}
                {t.ai_status === "failed" ? <p className="clear-err">Drafting failed: {t.ai_error}</p> : null}
                {t.ai_status === "done" ? <p className="admin-ok">AI draft created{t.ai_output?.model ? ` (${t.ai_output.model})` : ""}. Review it in step 4.</p> : null}
                {t.ai_output?.excerpts?.length ? (
                  <details className="cs-history">
                    <summary>Where each action came from</summary>
                    <ul>
                      {t.ai_output.excerpts.map((x, i) => (
                        <li key={i}>
                          <b>{x.text}</b>
                          {x.uncertain ? " (unclear — check)" : ""}: &ldquo;{x.excerpt}&rdquo;{x.time ? ` at ${x.time}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                {aiAvailable ? (
                  <div className="cs-inline">
                    <button type="button" className="btn btn-g" disabled={busy !== null} onClick={() => draftWithAi(t)}>
                      {busy === t.id ? "Drafting…" : t.ai_status === "failed" ? "Try again" : t.ai_status === "done" ? "Draft again" : "Draft with AI"}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="cp-sub">None yet.</p>
        )}
        <p>
          <Link href={`?stage=review`} className="au-text-link">Write or review the summary →</Link>
        </p>
      </section>
    </div>
  );
}
