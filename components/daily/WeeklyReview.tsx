"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveWeeklyReview, type ReviewChoice, type WeeklyReviewData } from "@/lib/actions/daily-review";
import { shareToCoach, stopSharing } from "@/lib/actions/coach-share";
import { CLOSER_WORDS, DECISION_WORDS, smallerTarget, unitWord } from "@/lib/daily-alignment";

type Area = { id: string; name: string };
const shortDay = (ymd: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(new Date(`${ymd}T12:00:00Z`));

// The weekly review: the evidence first (what was planned, what happened),
// then five questions. Every answer is optional; the choices for each action
// take effect when it's saved, so next week is ready without rebuilding it.
export function WeeklyReview({ data, areas }: { data: WeeklyReviewData; areas: Area[] }) {
  const router = useRouter();
  const r = data.review;
  const [moved, setMoved] = useState(r?.moved ?? "");
  const [helped, setHelped] = useState(r?.helped ?? "");
  const [inWay, setInWay] = useState(r?.in_way ?? "");
  const [closer, setCloser] = useState(r?.closer ?? null);
  const [decision, setDecision] = useState(r?.decision ?? null);
  const choosable = data.actions.filter((a) => a.status === "active" && a.measure !== "run");
  const [choices, setChoices] = useState<Record<string, { choice: ReviewChoice["choice"]; target: string }>>(() =>
    Object.fromEntries(
      choosable.map((a) => {
        const saved = r?.choices.find((c) => c.actionId === a.id);
        // A smaller target already took effect, so it shows as kept.
        return [a.id, { choice: saved?.choice === "smaller" ? "keep" : saved?.choice ?? "keep", target: "" }];
      })
    )
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [saved, setSaved] = useState(!!r);
  const [sharing, setSharing] = useState(false);
  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name ?? null;
  const touch = () => { setSaved(false); setStatus(null); };

  async function save() {
    setBusy(true);
    setStatus(null);
    const res = await saveWeeklyReview({
      week: data.week, goalId: data.step?.id ?? null, moved, helped, inWay, closer: data.step ? closer : null, decision: data.step ? decision : null,
      choices: choosable.map((a) => ({ actionId: a.id, choice: choices[a.id]?.choice ?? "keep", target: choices[a.id]?.choice === "smaller" ? Number(choices[a.id].target) || null : null })),
    });
    setBusy(false);
    if (!res.ok) return setStatus({ text: res.message, error: true });
    setSaved(true);
    // The smaller targets are now the targets.
    setChoices((x) => Object.fromEntries(Object.entries(x).map(([id, c]) => [id, c.choice === "smaller" ? { choice: "keep", target: "" } : c])));
    setStatus({ text: "Saved. It’s in your journal, and next week is set." });
    router.refresh();
  }

  async function share() {
    if (!r) return;
    setBusy(true);
    const res = await shareToCoach({ kind: "review", id: r.id });
    setBusy(false);
    setSharing(false);
    setStatus(res.ok ? { text: "Shared with your coach. Only this review." } : { text: res.message, error: true });
    if (res.ok) router.refresh();
  }

  async function unshare() {
    if (!data.sharedId) return;
    setBusy(true);
    const res = await stopSharing(data.sharedId);
    setBusy(false);
    setStatus(res.ok ? { text: "No longer shared. Your coach’s copy is deleted." } : { text: res.message, error: true });
    if (res.ok) router.refresh();
  }

  return (
    <div className="da-review">
      <div className="da-review-evidence">
        <section className="da-card" aria-labelledby="dr-actions-h">
          <h2 id="dr-actions-h">What was planned, what happened</h2>
          {data.actions.length ? (
            <ul className="da-evidence da-evidence-plan">
              {data.actions.map((a) => (
                <li key={a.id}>
                  <b>{a.name}</b>
                  <span>{a.happened}</span>
                  {a.plan ? <span className="da-small">Planned: {a.plan}</span> : null}
                  {areaName(a.areaId) ? <span className="da-area">{areaName(a.areaId)}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="da-small">No daily actions that week. <Link href="/daily" className="au-text-link">Add one on Today</Link> and next week&rsquo;s review will show it.</p>
          )}
        </section>

        {data.step ? (
          <section className="da-card" aria-labelledby="dr-step-h">
            <p className="da-k">Your Next Step · {data.step.area}</p>
            <h2 id="dr-step-h">{data.step.title}</h2>
            {data.step.moves.length ? (
              <ul className="da-evidence">
                {data.step.moves.map((m) => <li key={m.name}><b>{m.name}</b><span>{m.days ? `${m.days} day${m.days === 1 ? "" : "s"} ticked off` : "Not ticked off that week"}</span></li>)}
              </ul>
            ) : null}
            {data.step.count ? (
              <p className="da-small">Done when: {data.step.count.target} × {data.step.count.move} · <b>{Math.min(data.step.count.done, data.step.count.target)} of {data.step.count.target}</b> so far</p>
            ) : data.step.doneWhen ? (
              <p className="da-small">Done when: {data.step.doneWhen}</p>
            ) : null}
            {data.step.inTheWay ? <p className="da-why">What you said was in the way: <em>&ldquo;{data.step.inTheWay}&rdquo;</em></p> : null}
          </section>
        ) : null}

        {data.lastInWay ? (
          <p className="da-note">At your last review, what got in the way: <em>&ldquo;{data.lastInWay}&rdquo;</em></p>
        ) : null}

        <div className="da-two">
          <section className="da-card" aria-labelledby="dr-mindful-h">
            <h2 id="dr-mindful-h">Mindful minutes</h2>
            <p className="da-big">{data.mindful.minutes} <span>minutes</span></p>
            <p className="da-small">{data.mindful.sessions} session{data.mindful.sessions === 1 ? "" : "s"}</p>
          </section>
          <section className="da-card" aria-labelledby="dr-checkins-h">
            <h2 id="dr-checkins-h">Check-ins</h2>
            <p className="da-small">{data.checkIns.length ? data.checkIns.map((c) => `${shortDay(c.date)} ${c.rating}/5`).join(" · ") : "None that week."}</p>
          </section>
        </div>

        {data.notes.length ? (
          <section className="da-card" aria-labelledby="dr-notes-h">
            <h2 id="dr-notes-h">Your notes that week</h2>
            <ul className="da-notes">
              {data.notes.map((n) => <li key={n.id}><span className="da-small">{shortDay(n.date)}{n.prompt ? ` · ${n.prompt}` : ""}</span> {n.text}</li>)}
            </ul>
          </section>
        ) : null}
      </div>

      <form className="da-card da-review-form" aria-labelledby="dr-q-h" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <h2 id="dr-q-h">Your review</h2>
        <label className="da-field">
          <span>1. What moved?</span>
          <textarea rows={2} maxLength={2000} value={moved} onChange={(e) => { setMoved(e.target.value); touch(); }} placeholder="Even something small" />
        </label>
        <label className="da-field">
          <span>2. What helped?</span>
          <textarea rows={2} maxLength={2000} value={helped} onChange={(e) => { setHelped(e.target.value); touch(); }} />
        </label>
        <label className="da-field">
          <span>3. What got in the way?</span>
          <textarea rows={2} maxLength={2000} value={inWay} onChange={(e) => { setInWay(e.target.value); touch(); }} />
        </label>
        {data.step ? (
          <>
            <div className="da-field">
              <span id="dr-closer">4. Is your Next Step closer?</span>
              <div className="ns-choices" role="group" aria-labelledby="dr-closer">
                {(["closer", "same", "further"] as const).map((c) => (
                  <button key={c} type="button" aria-pressed={closer === c} onClick={() => { setCloser(closer === c ? null : c); touch(); }}>{CLOSER_WORDS[c]}</button>
                ))}
              </div>
            </div>
            <div className="da-field">
              <span id="dr-decision">5. Keep it, make it smaller or change it?</span>
              <div className="ns-choices" role="group" aria-labelledby="dr-decision">
                {(["keep", "smaller", "change"] as const).map((d) => (
                  <button key={d} type="button" aria-pressed={decision === d} onClick={() => { setDecision(decision === d ? null : d); touch(); }}>{DECISION_WORDS[d]}</button>
                ))}
              </div>
              {decision === "smaller" || decision === "change" ? (
                <p className="da-small">
                  {data.step.editHref ? <Link href={data.step.editHref} className="au-text-link">Change your moves →</Link> : null} You can make a move smaller or swap it for another there.
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        {choosable.length ? (
          <fieldset className="da-field da-choices">
            <legend>{data.step ? "And your daily actions next week?" : "4. Your daily actions next week: keep, smaller or pause?"}</legend>
            {choosable.map((a) => {
              const c = choices[a.id];
              const set = (patch: Partial<typeof c>) => { setChoices((x) => ({ ...x, [a.id]: { ...x[a.id], ...patch } })); touch(); };
              return (
                <div key={a.id} className="da-choice">
                  <b>{a.name}</b>
                  <div className="ns-choices" role="group" aria-label={`${a.name} next week`}>
                    <button type="button" aria-pressed={c.choice === "keep"} onClick={() => set({ choice: "keep" })}>Keep</button>
                    {a.target && a.target > 1 ? <button type="button" aria-pressed={c.choice === "smaller"} onClick={() => set({ choice: "smaller", target: String(smallerTarget(a.target!)) })}>Smaller</button> : null}
                    <button type="button" aria-pressed={c.choice === "pause"} onClick={() => set({ choice: "pause" })}>Pause for now</button>
                  </div>
                  {c.choice === "smaller" && a.target ? (
                    <label className="da-inline da-small">
                      <span>New target</span>
                      <input type="number" className="da-num" min={1} max={a.target - 1} inputMode="numeric" value={c.target} onChange={(e) => set({ target: e.target.value.replace(/[^0-9]/g, "").slice(0, 6) })} />
                      <span>{unitWord(a, Number(c.target) || 2)} {a.period === "day" ? "a day" : a.period === "month" ? "a month" : "a week"} (was {a.target})</span>
                    </label>
                  ) : null}
                </div>
              );
            })}
            <p className="da-small">Kept actions carry on as they are. Nothing needs setting up again.</p>
          </fieldset>
        ) : null}

        <div className="da-inline">
          <button type="submit" className="btn btn-p" disabled={busy || saved}>{busy ? "Saving…" : saved ? "Saved" : r ? "Save changes" : "Save my review"}</button>
          {saved ? <Link href="/daily" className="au-text-link">Back to today</Link> : null}
        </div>
        {status ? <p className={status.error ? "clear-err" : "da-small"} role={status.error ? "alert" : "status"}>{status.text}</p> : null}
        <p className="da-small">Private, and kept in your journal.{data.step ? " Your answer to “is it closer?” also counts as your Next Step’s weekly check-in." : ""}</p>

        {data.hasCoach && r && saved ? (
          <div className="da-share">
            {data.sharedId ? (
              <p className="da-small">Shared with your coach. <button type="button" className="au-text-link as-btn" disabled={busy} onClick={unshare}>Stop sharing</button></p>
            ) : sharing ? (
              <p className="da-small">
                Your coach will be able to read this review, and nothing else from your journal.{" "}
                <button type="button" className="da-btn" disabled={busy} onClick={share}>Share it</button>{" "}
                <button type="button" className="au-text-link as-btn" onClick={() => setSharing(false)}>Not now</button>
              </p>
            ) : (
              <button type="button" className="da-btn" onClick={() => setSharing(true)}>Share this review with my coach</button>
            )}
          </div>
        ) : null}
      </form>

      {data.hasCoach ? <QuestionForCoach /> : null}
    </div>
  );
}

// One question to bring to coaching: sent to their coach on its own.
export function QuestionForCoach() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  return (
    <section className="da-card" aria-labelledby="dr-ask-h">
      <h2 id="dr-ask-h">A question for your coach</h2>
      <label className="da-field">
        <span className="da-small">Something to bring to your next session. Only this goes to your coach.</span>
        <textarea rows={2} maxLength={2000} value={text} onChange={(e) => { setText(e.target.value); setStatus(null); }} />
      </label>
      <button
        type="button"
        className="da-btn"
        disabled={busy || !text.trim()}
        onClick={async () => {
          setBusy(true);
          const res = await shareToCoach({ kind: "question", text });
          setBusy(false);
          if (!res.ok) return setStatus({ text: res.message, error: true });
          setText("");
          setStatus({ text: "Sent to your coach." });
          router.refresh();
        }}
      >
        {busy ? "Sending…" : "Send to my coach"}
      </button>
      {status ? <p className={status.error ? "clear-err" : "da-small"} role={status.error ? "alert" : "status"}>{status.text}</p> : null}
    </section>
  );
}
