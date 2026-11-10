"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveScreen, takeOnNextStep, type BuildContext, type ScreenInput } from "@/lib/actions/next-step";
import { CHECKS, SCREENS, promptsFor, stepsBetween } from "@/lib/next-step";
import { NsFilm, NEXT_STEP_FILMS } from "./NsFilm";

type MoveRow = { key: string; id?: string; body: string; when: string };
type Status = { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string };

let keySeq = 0;
const newKey = () => `m${++keySeq}`;
const filled = (v: string) => !!v.trim();

// Setting a Next Step: five screens, in the order Duane set (10 Nov 2026):
// where you are, where you'd love it to be, your Next Step, what's in the
// way of it, and what it'll take. Each screen saves when you continue.
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

  const stepTitle = title.trim() || "your Next Step";
  const canContinue =
    screen === 3 ? filled(title) && aim !== null && filled(why)
    : screen === 4 ? filled(inTheWay)
    : screen === 5 ? moves.some((m) => filled(m.body)) && filled(done)
    : true;

  function input(n: number): ScreenInput {
    switch (n) {
      case 1: return { screen: 1, now };
      case 2: return { screen: 2, ten };
      case 3: return { screen: 3, title, aim: aim ?? 0, why, feel, checks };
      case 4: return { screen: 4, inTheWay, spill };
      default: return { screen: 5, moves: moves.map(({ id, body, when }) => ({ id, body, when })), done };
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
        <ol className="ns-stepper" aria-label="Setting your Next Step">
          {SCREENS.map((s, i) => (
            <li key={s} className={i + 1 === screen ? "on" : i + 1 < screen ? "done" : undefined} aria-current={i + 1 === screen ? "step" : undefined}>
              <span className="ns-stepper-bar" aria-hidden="true" />
              {s}
            </li>
          ))}
        </ol>

        {screen === 1 && (
          <>
            <h1>Where you <em>are.</em></h1>
            <p className="lead">Before you choose a step, say where you&rsquo;re standing. Your score and your words from The Aligned Protocol are here to start from.</p>
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
            <label className="au-start-q" htmlFor="ns-now">What&rsquo;s actually going on in this area right now?</label>
            <p className="au-start-help">In your own words. As much or as little as you like. Only you, and your coach if you have one, can see this.</p>
            <textarea id="ns-now" rows={5} value={now} onChange={(e) => setNow(e.target.value)} placeholder={p.examples.now} />
          </>
        )}

        {screen === 2 && (
          <>
            <h1>Where you&rsquo;d love it <em>to be.</em></h1>
            <p className="lead">Have some fun with this. Picture {area.name} at a 10. Don&rsquo;t make it sensible. This is the life you&rsquo;re working towards.</p>
            <label className="au-start-q" htmlFor="ns-ten">What would a 10 look like?</label>
            <p className="au-start-help">You may not know yet, and that&rsquo;s fine. Roughly is enough. If it helps:</p>
            <Prompts list={p.ten} />
            <textarea id="ns-ten" rows={4} value={ten} onChange={(e) => setTen(e.target.value)} placeholder={p.examples.ten} />
            <div className="au-sum-card ns-gold">
              <p className="au-detail-k">Keep this. We won&rsquo;t start here.</p>
              <p className="ns-strong">
                {start ? `From a ${start}, ` : ""}a 10 can feel too far away to start. So we&rsquo;ll keep it as your direction, and first find the one
                step that gets you out of where you&rsquo;re stuck. That first step often changes things more than any step after it.
              </p>
              {start ? (
                <>
                  <div className="ns-bar ns-bar-static" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, i) => <span key={i} className={i + 1 <= start ? "now" : i === 9 ? "far" : undefined} />)}
                  </div>
                  <p className="ns-bar-ends"><b>Now: {start}</b><span>Your 10</span></p>
                </>
              ) : null}
            </div>
          </>
        )}

        {screen === 3 && (
          <>
            <h1>Your Next <em>Step.</em></h1>
            <p className="lead">You&rsquo;ve seen where you&rsquo;d love it to be. Now for the step that comes first.</p>
            <div className="au-sum-card ns-gold">
              <p className="au-detail-k">Why your Next Step matters</p>
              <p className="ns-strong">
                {start ? `From a ${start}, ` : ""}a 10 can feel so far away that it keeps you stuck. Your Next Step isn&rsquo;t the 10. It&rsquo;s the one
                change that gets you out of where you are now: out of survival, and into a place where you can think and plan.
              </p>
              <div className="ns-three">
                <div><b>It comes first</b><span>Every step towards your 10 starts from here.</span></div>
                <div><b>It&rsquo;s the hardest</b><span>It takes the most energy and clarity of any step.</span></div>
                <div><b>It changes the most</b><span>Getting out of the rut often feels bigger than getting from 9 to 10.</span></div>
              </div>
            </div>
            <p className="au-start-q">So, what one change would get you out of where you&rsquo;re stuck?</p>
            <div className="ns-grid2">
              <div className="au-sum-card"><p className="au-detail-k">It can change around you</p><p>Something that happens out in your life: a client signed, a debt cleared, a move made.</p></div>
              <div className="au-sum-card"><p className="au-detail-k">Or change in you</p><p>Something you come to: getting clear, making a decision, forgiving, letting go.</p></div>
            </div>
            <label className="au-start-q" htmlFor="ns-step">My Next Step is…</label>
            <input id="ns-step" type="text" className="ns-big" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={p.examples.step} />

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
            <h1>What&rsquo;s in <em>the way?</em></h1>
            <p className="lead">Now you know your Next Step, look at what stands between you and it. In survival mode it&rsquo;s hard to see clearly, so name it plainly. What you name here, your moves can work on.</p>
            <div className="au-sum-card ns-gold ns-pin">
              <p className="au-detail-k">Your Next Step</p>
              <p className="ns-quote">{stepTitle}</p>
            </div>
            <label className="au-start-q" htmlFor="ns-way">What&rsquo;s in the way of it?</label>
            <p className="au-start-help">If it helps:</p>
            <Prompts list={p.way} />
            <textarea id="ns-way" rows={4} value={inTheWay} onChange={(e) => setInTheWay(e.target.value)} placeholder={p.examples.way} />
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
            <h1>What it&rsquo;ll <em>take.</em></h1>
            <p className="lead">
              The moves that get you to <b className="ns-white">{stepTitle}</b>. Split it into moves you believe you can do. Some once, some every week. Add what
              you know now; you can change them as you learn.
            </p>
            <NsFilm clip={NEXT_STEP_FILMS.moves} caption="Duane on making your Next Step believable" />
            <p className="au-detail-k ns-moves-k">Your moves</p>
            <ol className="ns-moves">
              {moves.map((m, i) => (
                <li key={m.key}>
                  <input type="text" aria-label={`Move ${i + 1}`} maxLength={200} value={m.body} onChange={(e) => setMove(m.key, "body", e.target.value)} placeholder={i === 0 ? p.examples.move : "Another move"} />
                  <input type="text" aria-label={`When, for move ${i + 1}`} maxLength={120} value={m.when} onChange={(e) => setMove(m.key, "when", e.target.value)} placeholder="When? e.g. By Friday, Every Monday" />
                  {moves.length > 1 ? (
                    <button type="button" className="ns-remove" aria-label={`Remove move ${i + 1}`} onClick={() => setMoves((ms) => ms.filter((x) => x.key !== m.key))}>✕</button>
                  ) : <span />}
                </li>
              ))}
            </ol>
            {moves.length < 20 ? (
              <button type="button" className="ns-add" onClick={() => setMoves((ms) => [...ms, { key: newKey(), body: "", when: "" }])}>+ Add a move</button>
            ) : null}
            <div className="au-sum-card ns-coach-note">
              <p><b>With a coach?</b> Steps you agree in a session appear with your moves, linked to this Next Step, so you both work from one list.</p>
            </div>
            <label className="au-start-q" htmlFor="ns-done">How will you know it&rsquo;s taken?</label>
            <p className="au-start-help">One clear sign. Could someone else tell it had happened?</p>
            <input id="ns-done" type="text" value={done} onChange={(e) => setDone(e.target.value)} placeholder={p.examples.done} />
          </>
        )}
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
