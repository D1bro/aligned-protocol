"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runStepReviewRead, saveStepReview, sendStepReview, unsendStepReview, type StepReview as Review } from "@/lib/actions/step-review";
import { PART_LABEL, reviewFlags, type ReviewContent, type ReviewFlag, type ReviewPart } from "@/lib/next-step-review";
import { moveDays, whenLabel } from "@/lib/daily-log";
import { WhenPicker } from "@/components/next-step/WhenPicker";

type Current = {
  title: string;
  name: string | null;
  why: string | null;
  done: string | null;
  countTarget: number | null;
  countMoveId: string | null;
  start: number | null;
  aim: number | null;
  inTheWay: string | null;
  moves: { id: string; body: string; when_text: string | null }[];
};
type MoveRow = { key: string; id?: string; body: string; when: string };
const PARTS: ReviewPart[] = ["why", "step", "done", "aim", "moves", "way"];
let keys = 0;
const newKey = () => `r${++keys}`;
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });

// The Next Step review on Prepare (Duane, 10 Nov 2026): what the member wrote,
// what's worth raising and the question to ask (the app's own checks, and the
// AI read if run), and the sharper version agreed together in the session.
// Saved as a draft; sent to the member, who keeps it or not. Coach only.
export function StepReview({
  clientId,
  firstName,
  goalId,
  current,
  review,
  worked,
  aiAvailable,
}: {
  clientId: string;
  firstName: string;
  goalId: string;
  current: Current;
  review: Review | null;
  worked: string[];
  aiAvailable: boolean;
}) {
  const router = useRouter();
  const open = review && !review.answeredAt ? review : null;
  const c: ReviewContent = open?.content ?? {};
  const sent = !!open?.sentAt;
  const [why, setWhy] = useState(c.why ?? current.why ?? "");
  const [title, setTitle] = useState(c.title ?? current.title);
  const [done, setDone] = useState(c.done ?? current.done ?? "");
  const [aim, setAim] = useState<string>(String(c.aim ?? current.aim ?? ""));
  const [moves, setMoves] = useState<MoveRow[]>(() =>
    (c.moves?.length ? c.moves : current.moves.map((m) => ({ id: m.id, body: m.body, when: m.when_text ?? "" }))).map((m) => ({ key: newKey(), ...m }))
  );
  const [countTarget, setCountTarget] = useState<string>(String(c.countTarget ?? current.countTarget ?? ""));
  const [countKey, setCountKey] = useState<string>(() => {
    const i = c.countMove ?? (current.countMoveId ? current.moves.findIndex((m) => m.id === current.countMoveId) : -1);
    return i != null && i >= 0 ? moves[i]?.key ?? "" : "";
  });
  const [note, setNote] = useState(c.note ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const flags = reviewFlags({
    title: current.title,
    why: current.why,
    done: current.done,
    countTarget: current.countTarget,
    start: current.start,
    aim: current.aim,
    inTheWay: current.inTheWay,
    moves: current.moves,
  });
  const ai = c.ai ?? null;
  const flagsFor = (part: ReviewPart): (ReviewFlag & { by: "app" | "ai" })[] => [
    ...flags.filter((f) => f.part === part).map((f) => ({ ...f, by: "app" as const })),
    ...(ai?.flags ?? []).filter((f) => f.part === part).map((f) => ({ ...f, by: "ai" as const })),
  ];

  function content(): ReviewContent {
    const kept = moves.filter((m) => m.body.trim());
    const i = countKey ? kept.findIndex((m) => m.key === countKey) : -1;
    return {
      why,
      title,
      done,
      aim: aim ? Number(aim) : null,
      countTarget: countTarget && i !== -1 ? Number(countTarget) : null,
      countMove: i === -1 ? null : i,
      moves: kept.map(({ id, body, when }) => ({ ...(id ? { id } : {}), body, when })),
      note,
    };
  }

  async function run(key: string, fn: () => Promise<{ ok: boolean; message?: string }>, ok: string) {
    setBusy(key);
    setStatus(null);
    const res = await fn();
    setBusy(null);
    if (!res.ok) return setStatus({ ok: false, text: res.message ?? "Couldn’t save — try again." });
    setStatus({ ok: true, text: ok });
    router.refresh();
  }

  const setMove = (key: string, field: "body" | "when", value: string) => setMoves((ms) => ms.map((m) => (m.key === key ? { ...m, [field]: value } : m)));
  const wrote: Record<ReviewPart, React.ReactNode> = {
    why: current.why?.trim() ? <>&ldquo;{current.why.trim()}&rdquo;</> : <em>Not written</em>,
    step: <>&ldquo;{current.title}&rdquo;</>,
    done: current.done?.trim() ? <>&ldquo;{current.done.trim()}&rdquo;{current.countTarget ? ` (counted: ${current.countTarget})` : ""}</> : <em>Not written</em>,
    aim: current.start && current.aim ? `${current.start} → ${current.aim}` : current.aim ? `Aiming for ${current.aim}` : <em>Not set</em>,
    moves: current.moves.length ? (
      <ul className="sr-moves">{current.moves.map((m) => <li key={m.id}>{m.body}{m.when_text?.trim() ? <span> · {whenLabel(m.when_text)}</span> : null}</li>)}</ul>
    ) : <em>None yet</em>,
    way: current.inTheWay?.trim() ? <>&ldquo;{current.inTheWay.trim()}&rdquo;</> : <em>Not written</em>,
  };
  const disabled = sent || busy !== null;

  const agreed: Record<ReviewPart, React.ReactNode> = {
    why: <textarea rows={3} aria-label="Why, agreed" value={why} disabled={disabled} onChange={(e) => setWhy(e.target.value)} placeholder="The after-feeling, in their words" />,
    step: <textarea rows={2} aria-label="The step, agreed" value={title} disabled={disabled} onChange={(e) => setTitle(e.target.value)} />,
    done: (
      <div className="sr-stack">
        <textarea rows={2} aria-label="Done when, agreed" value={done} disabled={disabled} onChange={(e) => setDone(e.target.value)} placeholder="Something you can both count or see" />
        <div className="sr-count">
          <input type="number" inputMode="numeric" min={1} max={365} aria-label="Count: how many times" value={countTarget} disabled={disabled} onChange={(e) => setCountTarget(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} placeholder="8" />
          <span>×</span>
          <select aria-label="Count: which move" value={countKey} disabled={disabled} onChange={(e) => setCountKey(e.target.value)}>
            <option value="">Count a move (optional)</option>
            {moves.filter((m) => m.body.trim()).map((m) => <option key={m.key} value={m.key}>{m.body.trim()}</option>)}
          </select>
        </div>
      </div>
    ),
    aim: (
      <select aria-label="Aiming for, agreed" value={aim} disabled={disabled} onChange={(e) => setAim(e.target.value)}>
        <option value="">Not set</option>
        {Array.from({ length: 10 }, (_, i) => i + 1).filter((n) => !current.start || n > current.start).map((n) => <option key={n} value={n}>{current.start ? `${current.start} → ${n}` : n}</option>)}
      </select>
    ),
    moves: (
      <div className="sr-stack">
        {moves.map((m, i) => {
          return (
            <div key={m.key} className="sr-move">
              <input type="text" aria-label={`Move ${i + 1}`} value={m.body} maxLength={200} disabled={disabled} onChange={(e) => setMove(m.key, "body", e.target.value)} placeholder="One thing" />
              <button type="button" className="ns-remove" aria-label={`Remove move ${i + 1}`} disabled={disabled} onClick={() => setMoves((ms) => ms.filter((x) => x.key !== m.key))}>✕</button>
              <WhenPicker value={m.when} onChange={(v) => setMove(m.key, "when", v)} label={`move ${i + 1}`} disabled={disabled} />
              {m.body.trim() ? <span className="sr-when">{moveDays(m.when).length ? `In Today: ${whenLabel(m.when)}` : m.when.trim() ? `Once: ${m.when.trim()}` : "Once"}</span> : null}
            </div>
          );
        })}
        {!sent && moves.length < 20 ? <button type="button" className="au-text-link as-btn" onClick={() => setMoves((ms) => [...ms, { key: newKey(), body: "", when: "" }])}>+ Add a move</button> : null}
      </div>
    ),
    way: <p className="admin-card-sub">Answer it with a move, above.</p>,
  };

  return (
    <section className="admin-card sr" aria-labelledby="desk-review-h">
      <div className="sr-head">
        <div>
          <h2 id="desk-review-h">Next Step review</h2>
          <p className="admin-card-sub">
            What {firstName} wrote, what&rsquo;s worth raising and the question to ask, and the version you agree together. {firstName} owns the words: it goes to them to keep.
          </p>
        </div>
        {aiAvailable ? (
          <button type="button" className="btn btn-g" disabled={busy !== null} onClick={() => run("ai", () => runStepReviewRead({ goalId, clientId }), "Read. The AI’s points are marked AI.")}>
            {busy === "ai" ? "Reading…" : ai ? "Read it again" : "Read it with AI"}
          </button>
        ) : null}
      </div>

      {ai?.opening ? <p className="sr-opening"><span className="au-detail-k">Opening question</span> &ldquo;{ai.opening}&rdquo;</p> : null}

      <div className="sr-table" role="table" aria-label="Next Step review">
        <div className="sr-row sr-th" role="row">
          <span role="columnheader" />
          <span role="columnheader">{firstName} wrote</span>
          <span role="columnheader">Worth raising · ask</span>
          <span role="columnheader">Agreed together</span>
        </div>
        {PARTS.map((part) => {
          const fl = flagsFor(part);
          return (
            <div key={part} className="sr-row" role="row">
              <span role="rowheader" className="sr-part">{PART_LABEL[part]}</span>
              <span role="cell" className="sr-wrote">{wrote[part]}</span>
              <span role="cell" className="sr-flags">
                {fl.length ? fl.map((f, i) => (
                  <span key={i} className="sr-flag">
                    {f.by === "ai" ? <span className="sr-ai">AI</span> : null}
                    <b>{f.flag}</b> <i>&ldquo;{f.ask}&rdquo;</i>
                  </span>
                )) : <span className="sr-ok">Looks clear.</span>}
              </span>
              <span role="cell" className="sr-agreed">{agreed[part]}</span>
            </div>
          );
        })}
      </div>

      {worked.length || ai?.worked.length ? (
        <div className="sr-worked">
          <p className="au-detail-k">What&rsquo;s worked before</p>
          <ul>{[...new Set([...(ai?.worked ?? []), ...worked])].slice(0, 6).map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      ) : null}

      <label className="au-detail-k" htmlFor="sr-note">A line to {firstName} with it (optional)</label>
      <textarea id="sr-note" rows={2} value={note} disabled={disabled} onChange={(e) => setNote(e.target.value)} placeholder="What we agreed today, in your words to them" />

      <div className="sr-actions">
        {sent ? (
          <>
            <p className="admin-card-sub">Sent {date(open!.sentAt!)}. Waiting for {firstName} to keep it.</p>
            <button type="button" className="au-text-link as-btn" disabled={busy !== null} onClick={() => run("back", () => unsendStepReview({ goalId, clientId }), "Taken back. Change it and send again.")}>Take it back to change</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-p" disabled={busy !== null} onClick={() => run("send", () => sendStepReview({ goalId, clientId, content: content() }), `Sent. ${firstName} will see it on The Next Step.`)}>
              {busy === "send" ? "Sending…" : `Send to ${firstName} to keep`}
            </button>
            <button type="button" className="btn btn-g" disabled={busy !== null} onClick={() => run("save", () => saveStepReview({ goalId, clientId, content: content() }), "Draft saved. Only you can see it.")}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </button>
          </>
        )}
        {review?.answeredAt ? (
          <p className="admin-card-sub">Last review: {review.answer === "kept" ? `kept by ${firstName}` : `put aside by ${firstName}`} on {date(review.answeredAt)}.</p>
        ) : null}
        {status ? <p className={status.ok ? "admin-ok" : "clear-err"} role="status">{status.text}</p> : null}
      </div>
    </section>
  );
}
