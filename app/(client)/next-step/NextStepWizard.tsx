"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveScreen, takeOnNextStep, type BuildContext, type ScreenInput } from "@/lib/actions/next-step";
import { CHECKS, SCREENS, looksLikeSeveral, promptsFor, stepsBetween } from "@/lib/next-step";
import { daysLabel, moveDays } from "@/lib/daily-log";
import { twoInOne } from "@/lib/next-step-review";
import { NsMap, NsStepper } from "@/components/next-step/NsMap";
import { NsFilm, NEXT_STEP_FILMS } from "./NsFilm";

type MoveRow = { key: string; id?: string; body: string; when: string };
type Status = { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string };

let keySeq = 0;
const newKey = () => `m${++keySeq}`;
const filled = (v: string) => !!v.trim();

// Setting a Next Step: five screens, walked as one map (Duane, 10 Nov 2026):
// you are here, your destination (the X, their 10), your Next Step (the
// camp), what's in the way (rough ground) and your route (the moves). Each
// screen saves when you continue.
export function NextStepWizard({ ctx, startScreen }: { ctx: BuildContext; startScreen: number }) {
  const router = useRouter();
  const { plan, area, goal } = ctx;
  const start = ctx.score;
  const p = promptsFor(area.name);
  const [screen, setScreen] = useState(Math.min(5, Math.max(1, startScreen)));
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const [now, setNow] = useState(plan.current_reality ?? "");
  const [ten, setTen] = useState(plan.life_vision ?? "");
  const [title, setTitle] = useState(goal?.goal_title ?? "");
  const [name, setName] = useState(goal?.step_name ?? "");
  const [aim, setAim] = useState<number | null>(goal?.aim_score ?? null);
  const [why, setWhy] = useState(goal?.motivation_text ?? plan.why_it_matters ?? "");
  const [feel, setFeel] = useState(goal?.feel_text ?? "");
  const [checks, setChecks] = useState<Record<string, boolean>>(goal?.step_checks ?? {});
  const [inTheWay, setInTheWay] = useState(goal?.in_the_way ?? "");
  const [spill, setSpill] = useState(goal?.spill_over ?? "");
  const [moves, setMoves] = useState<MoveRow[]>(() =>
    ctx.moves.length ? ctx.moves.map((m) => ({ key: newKey(), id: m.id, body: m.body, when: m.when_text ?? "" })) : [{ key: newKey(), body: "", when: "" }]
  );
  const [done, setDone] = useState(goal?.success_criteria ?? "");
  // "Done when", counted (optional): this many ticks of one move.
  const [countTarget, setCountTarget] = useState(goal?.count_target ? String(goal.count_target) : "");
  const [countKey, setCountKey] = useState<string>(() => {
    const i = ctx.moves.findIndex((m) => m.id === goal?.count_move_id);
    return i === -1 ? "" : moves[i]?.key ?? "";
  });

  const stepTitle = name.trim() || title.trim() || "your Next Step";
  const canContinue =
    screen === 3 ? filled(title) && aim !== null && filled(why)
    : screen === 4 ? filled(inTheWay)
    : screen === 5 ? moves.some((m) => filled(m.body)) && filled(done)
    : true;

  function input(n: number): ScreenInput {
    switch (n) {
      case 1: return { screen: 1, now };
      case 2: return { screen: 2, ten };
      case 3: return { screen: 3, title, name, aim: aim ?? 0, why, feel, checks };
      case 4: return { screen: 4, inTheWay, spill };
      default: {
        const kept = moves.filter((m) => filled(m.body));
        const countMove = countKey ? kept.findIndex((m) => m.key === countKey) : -1;
        return {
          screen: 5,
          moves: moves.map(({ id, body, when }) => ({ id, body, when })),
          done,
          countTarget: countTarget && countMove !== -1 ? Number(countTarget) : null,
          countMove: countMove === -1 ? null : countMove,
        };
      }
    }
  }

  function go(n: number) {
    setScreen(n);
    window.history.replaceState(null, "", `/next-step/build?plan=${plan.id}&step=${n}`);
    window.scrollTo({ top: 0 });
  }

  async function next() {
    setStatus({ kind: "saving" });
    const res = await saveScreen(plan.id, input(screen));
    if (!res.ok) return setStatus({ kind: "error", message: res.message });
    if (screen < 5) {
      setStatus({ kind: "idle" });
      return go(screen + 1);
    }
    const taken = await takeOnNextStep(plan.id);
    if (!taken.ok) return setStatus({ kind: "error", message: taken.message });
    router.push(`/next-step/set?plan=${plan.id}`);
  }

  async function back() {
    // Free writing (screens 1–2) is kept even when going back.
    if (screen <= 2) await saveScreen(plan.id, input(screen));
    if (screen > 1) go(screen - 1);
    else router.push("/next-step");
  }

  const setMove = (key: string, field: "body" | "when", value: string) =>
    setMoves((ms) => ms.map((m) => (m.key === key ? { ...m, [field]: value } : m)));

  const statusText = status.kind === "saving" ? "Saving…" : status.kind === "error" ? status.message : "";

  return (
    <>
      <div className="page au-page ns-page">
        <div className="eyebrow"><span className="eydot" /> The Next Step · {area.name}</div>
        <NsStepper screen={screen} labels={SCREENS} />

        <div className="ns-layout">
          <aside className="ns-layout-map">
            <NsMap stage={screen} area={area.name} start={start} aim={aim} moves={moves} />
          </aside>
          <div className="ns-layout-main">
        {screen === 1 && (
          <>
            <h1>You are <em>here.</em></h1>
            <p className="lead">You can&rsquo;t find your way from a place you won&rsquo;t name. Once you know where you&rsquo;re standing, you&rsquo;re no longer lost.</p>
            <NsFilm clip={NEXT_STEP_FILMS.here} caption="Duane on where you are" />
            <div className="ns-grid2">
              <div className="au-sum-card ns-score">
                <span className="ns-score-n" aria-hidden="true">{start ?? "–"}</span>
                <div>
                  <p className="au-detail-k">Your score</p>
                  <p className="ns-strong">{area.name}{start ? <>, <b>{start} out of 10</b></> : null}</p>
                  <p className="au-small">From your Protocol</p>
                </div>
              </div>
              {ctx.auditNote ? (
                <div className="au-sum-card">
                  <p className="au-detail-k">You wrote</p>
                  <p className="ns-quote">&ldquo;{ctx.auditNote}&rdquo;</p>
                </div>
              ) : null}
            </div>
            <label className="au-start-q" htmlFor="ns-now">What&rsquo;s really going on in {area.name} right now?</label>
            <p className="au-start-help">Include the part you&rsquo;d normally skip over. Only you, and your coach if you have one, will see this.</p>
            <textarea id="ns-now" rows={5} value={now} onChange={(e) => setNow(e.target.value)} placeholder={p.examples.now} />
          </>
        )}

        {screen === 2 && (
          <>
            <h1>Your <em>destination.</em></h1>
            <p className="lead">Every map needs an X. Don&rsquo;t make it sensible; make it worth the climb. This is {area.name} at a 10.</p>
            <NsFilm clip={NEXT_STEP_FILMS.ten} caption="Duane on your destination" />
            <label className="au-start-q" htmlFor="ns-ten">It&rsquo;s a 10. What does an ordinary Tuesday look like?</label>
            <p className="au-start-help">You may not know yet, and that&rsquo;s fine. Roughly is enough. If it helps:</p>
            <Prompts list={p.ten} />
            <textarea id="ns-ten" rows={4} value={ten} onChange={(e) => setTen(e.target.value)} placeholder={p.examples.ten} />
          </>
        )}

        {screen === 3 && (
          <>
            <h1>Your Next <em>Step.</em></h1>
            <p className="lead">Not the whole climb. The one move that gets you off the ground. It comes first, it takes the most, and it changes the most.</p>
            <NsFilm clip={NEXT_STEP_FILMS.step} caption="Duane on your Next Step" />
            <label className="au-start-q" htmlFor="ns-step">What&rsquo;s the one change that, once it&rsquo;s made, means you&rsquo;re no longer stuck?</label>
            <p className="au-start-help">
              It can change around you (a client signed, a debt cleared) or in you (getting clear, making a decision, letting go). If it has
              &ldquo;and&rdquo; in it, it&rsquo;s probably two steps.
            </p>
            <textarea id="ns-step" rows={3} className="ns-big ns-step-text" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={p.examples.step} />
            {looksLikeSeveral(title) ? (
              <div className="ns-nudge" role="note">
                <p className="ns-strong">That sounds like more than one step.</p>
                <p>Which one, done first, makes the rest easier? Keep that one here; the others can be your next Next Step.</p>
              </div>
            ) : null}

            <label className="au-start-q" htmlFor="ns-name">Give it a name you&rsquo;d say out loud <span className="au-small">Optional</span></label>
            <p className="au-start-help">A few words you&rsquo;ll recognise at a glance. It&rsquo;s what The Next Step page leads with.</p>
            <input id="ns-name" type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="The business sells on its own" />

            <p className="au-start-q">How far could it take you?</p>
            <p className="au-start-help">
              Your best guess.{start ? ` You’re at ${start}: tap where you think it could take you.` : " Tap where you think it could take you."} You&rsquo;ll score it again once it&rsquo;s taken.
            </p>
            <div className="ns-bar" role="group" aria-label="How far could it take you?">
              {Array.from({ length: 10 }, (_, i) => {
                const n = i + 1;
                const isNow = start !== null && n <= start;
                const pickable = start === null || n > start || (start === 10 && n === 10);
                const cls = aim === n ? "tgt" : isNow ? "now" : aim !== null && n < aim ? "aim" : "";
                return (
                  <button key={n} type="button" className={cls} disabled={!pickable} aria-pressed={aim === n} aria-label={isNow ? `Now ${start}` : `Aim for ${n}`} onClick={() => setAim(n)}>
                    <span aria-hidden="true" />
                    {n}
                  </button>
                );
              })}
            </div>
            {aim !== null && start !== null && aim > start ? (
              <p className="ns-strong" aria-live="polite">From {start} towards <b className="ns-gold-t">{aim}</b><span className="au-small">: {stepsBetween(start, aim)}</span></p>
            ) : null}

            <label className="au-start-q" htmlFor="ns-why">Why this one?</label>
            <p className="au-start-help">What would it take off you? This is what you&rsquo;ll come back to on a hard week.</p>
            <textarea id="ns-why" rows={3} value={why} onChange={(e) => setWhy(e.target.value)} placeholder={p.examples.why} />

            <label className="au-start-q" htmlFor="ns-feel">What will it feel like when you&rsquo;ve taken it?</label>
            <p className="au-start-help">Picture the day it happens.</p>
            <textarea id="ns-feel" rows={2} value={feel} onChange={(e) => setFeel(e.target.value)} placeholder={p.examples.feel} />

            <div className="au-sum-card ns-checks">
              <p className="au-detail-k">Check it</p>
              <p className="au-start-help">Not yet on any of these? Sharpen it until it&rsquo;s a yes. Your coach can help.</p>
              {CHECKS.map((c) => (
                <div key={c.key} className="ns-check">
                  <span>{c.question(area.name)}</span>
                  <span className="au-chips" role="group" aria-label={c.question(area.name)}>
                    <button type="button" aria-pressed={checks[c.key] === true} onClick={() => setChecks((x) => ({ ...x, [c.key]: true }))}>Yes</button>
                    <button type="button" aria-pressed={checks[c.key] === false} onClick={() => setChecks((x) => ({ ...x, [c.key]: false }))}>Not yet</button>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {screen === 4 && (
          <>
            <h1>What&rsquo;s in <em>the way.</em></h1>
            <p className="lead">Every route has rough ground. Name it now and it can&rsquo;t ambush you halfway up.</p>
            <NsFilm clip={NEXT_STEP_FILMS.way} caption="Duane on what gets in the way" />
            <div className="au-sum-card ns-gold ns-pin">
              <p className="au-detail-k">Your Next Step</p>
              <p className="ns-quote">{stepTitle}</p>
            </div>
            <label className="au-start-q" htmlFor="ns-way">What&rsquo;s most likely to stop you, out there or in you?</label>
            <p className="au-start-help">Be honest. It often starts with one of these:</p>
            <Prompts list={p.way} />
            <textarea id="ns-way" rows={4} value={inTheWay} onChange={(e) => setInTheWay(e.target.value)} placeholder={p.examples.way} />
            {ctx.lowWellbeing ? (
              <div className="au-sum-card clear-support ns-support">
                <h3>You don&rsquo;t have to do this alone</h3>
                <p>
                  If things feel heavy right now, it&rsquo;s worth talking to someone you trust, your GP, or a qualified professional. If you&rsquo;re
                  in crisis, contact your local emergency services or a crisis line.
                </p>
              </div>
            ) : null}
            <div className="au-sum-card ns-spill">
              <label className="au-start-q" htmlFor="ns-spill">How is being stuck affecting the rest of your life? <span className="au-small">Optional</span></label>
              <p className="au-start-help">The areas of your chart lean on each other. Notice where this one spills over.</p>
              <Prompts list={p.spill} />
              <textarea id="ns-spill" rows={3} value={spill} onChange={(e) => setSpill(e.target.value)} />
            </div>
          </>
        )}

        {screen === 5 && (
          <>
            <h1>Your <em>route.</em></h1>
            <p className="lead">Big steps are made of small moves. Make the first one so clear you could do it tomorrow.</p>
            <NsFilm clip={NEXT_STEP_FILMS.moves} caption="Duane on your route" />
            <p className="au-start-q">What are your moves to <b className="ns-white">{stepTitle}</b>, and when will you make them?</p>
            <p className="au-start-help">Some once, some every week. They&rsquo;ll show up in Today on My Space, and you can change them as you learn.</p>
            {ctx.worked.length ? (
              <div className="au-sum-card ns-worked">
                <p className="au-detail-k">What&rsquo;s worked before, from your sessions</p>
                <ul>{ctx.worked.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            ) : null}
            <ol className="ns-moves">
              {moves.map((m, i) => {
                const days = moveDays(m.when);
                return (
                  <li key={m.key}>
                    <input type="text" aria-label={`Move ${i + 1}`} maxLength={200} value={m.body} onChange={(e) => setMove(m.key, "body", e.target.value)} placeholder={i === 0 ? p.examples.move : "Another move"} />
                    <input type="text" aria-label={`When, for move ${i + 1}`} maxLength={120} value={m.when} onChange={(e) => setMove(m.key, "when", e.target.value)} placeholder="When? e.g. Monday and Thursday" />
                    {moves.length > 1 ? (
                      <button type="button" className="ns-remove" aria-label={`Remove move ${i + 1}`} onClick={() => setMoves((ms) => ms.filter((x) => x.key !== m.key))}>✕</button>
                    ) : <span />}
                    {filled(m.body) ? (
                      <p className="ns-move-hint" aria-live="polite">
                        {twoInOne(m.body) ? <><b>Two things in one?</b> Give each its own move, so each gets its own tick. </> : null}
                        {days.length ? `In Today every ${daysLabel(days) === "Every day" ? "day" : daysLabel(days).replace(/^Every /, "")}, with a tick.` : "In Today until you tick it once. For a move that repeats, add the days."}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            {moves.length < 20 ? (
              <button type="button" className="ns-add" onClick={() => setMoves((ms) => [...ms, { key: newKey(), body: "", when: "" }])}>+ Add a move</button>
            ) : null}
            {filled(inTheWay) ? (
              <div className="ns-nudge" role="note">
                <p><b>When that happens…</b> You said what gets in the way: &ldquo;{inTheWay.trim()}&rdquo;</p>
                <p>Is there a move for that moment? What will you do instead?</p>
              </div>
            ) : null}
            <div className="au-sum-card ns-coach-note">
              <p><b>With a coach?</b> Steps you agree in a session appear with your moves, linked to this Next Step, so you both work from one list.</p>
            </div>
            <label className="au-start-q" htmlFor="ns-done">How will you know you&rsquo;ve arrived?</label>
            <p className="au-start-help">One clear sign. Could someone else tell it had happened?</p>
            <input id="ns-done" type="text" value={done} onChange={(e) => setDone(e.target.value)} placeholder={p.examples.done} />
            {moves.some((m) => filled(m.body) && moveDays(m.when).length) ? (
              <div className="ns-count-set">
                <p className="au-start-help">Can you count it? Then you&rsquo;ll both see how close you are, and know the day it&rsquo;s done. (Optional)</p>
                <div className="ns-count-row">
                  <label htmlFor="ns-count-n" className="sr-only">How many times</label>
                  <input id="ns-count-n" type="number" inputMode="numeric" min={1} max={365} value={countTarget} onChange={(e) => setCountTarget(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))} placeholder="8" />
                  <span>times</span>
                  <label htmlFor="ns-count-m" className="sr-only">Which move</label>
                  <select id="ns-count-m" value={countKey} onChange={(e) => setCountKey(e.target.value)}>
                    <option value="">Choose the move to count</option>
                    {moves.filter((m) => filled(m.body) && moveDays(m.when).length).map((m) => <option key={m.key} value={m.key}>{m.body.trim()}</option>)}
                  </select>
                </div>
              </div>
            ) : null}
          </>
        )}
          </div>
        </div>
      </div>

      <div className="foot-nav">
        <button type="button" className="au-text-link as-btn" onClick={back} disabled={status.kind === "saving"}>← Back</button>
        <span className={`tb-label${status.kind === "error" ? " clear-err" : ""}`} aria-live="polite">{statusText}</span>
        <button type="button" className="btn btn-p" disabled={status.kind === "saving" || !canContinue} onClick={next}>
          {screen === 5 ? "Take this step →" : "Continue →"}
        </button>
      </div>
    </>
  );
}

function Prompts({ list }: { list: string[] }) {
  if (!list.length) return null;
  return (
    <ul className="ns-prompts">
      {list.map((q) => <li key={q}>{q}</li>)}
    </ul>
  );
}
