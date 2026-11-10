"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addOwnAction, removeOwnAction, setOwnActionDone, setPlanActionDone } from "@/lib/actions/planning";
import { setMoveDone, setMoveTick } from "@/lib/actions/next-step";
import { reportProgress } from "@/lib/actions/member-coaching";
import type { PlanAction } from "@/lib/planning";
import type { TodayAction, TodayMove } from "@/lib/daily-log";

// Today's actions, the daily log: every move due today from their Next Steps
// (each with its own tick), their session actions linked to a Next Step or
// due, and any they've added, each linked to a goal where it fits. Older
// plans with no moves show the plan's own action. Ticking saves straight away.
export function TodayActions({
  plan,
  moves = [],
  sessionActions = [],
  own,
  goals,
  defaultGoalId,
}: {
  // moveId: a one-off move, ticked off as the move itself.
  plan: { goalId: string; body: string; done: boolean; moveId?: string } | null;
  moves?: (TodayMove & { step: string })[];
  sessionActions?: TodayAction[];
  own: PlanAction[];
  goals: { id: string; title: string }[];
  defaultGoalId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [body, setBody] = useState("");
  const [goalId, setGoalId] = useState(defaultGoalId ?? "");

  async function run(step: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(true);
    setError(null);
    const result = await step();
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "Couldn’t save just now — try again.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function add() {
    if (await run(() => addOwnAction({ body, goalId: goalId || null }))) {
      setBody("");
      setAdding(false);
    }
  }

  // One Next Step: name it once above the list, not on every move.
  const oneStep = moves.length > 0 && new Set(moves.map((m) => m.step)).size === 1;

  return (
    <div className="ms-actions">
      {oneStep ? <p className="ms-today-step">Your Next Step · <b>{moves[0].step}</b></p> : null}
      {plan || own.length || moves.length || sessionActions.length ? (
        <ul className="ms-action-list">
          {moves.map((m) => (
            <li key={m.moveId}>
              <label>
                <input
                  type="checkbox"
                  checked={m.done}
                  disabled={busy}
                  onChange={(e) => run(() => (m.kind === "repeat" ? setMoveTick(m.moveId, e.target.checked) : setMoveDone(m.moveId, e.target.checked)))}
                />
                <span>{m.body}{m.when ? <span className="ms-action-when"> · {m.when}</span> : null}</span>
              </label>
              {oneStep ? null : <span className="ms-action-tag">{m.step || "Your Next Step"}</span>}
            </li>
          ))}
          {sessionActions.map((a) => (
            <li key={a.id}>
              <label>
                <input
                  type="checkbox"
                  checked={a.done}
                  disabled={busy}
                  onChange={(e) => run(() => reportProgress({ commitmentId: a.id, progress: e.target.checked ? "done" : "not_yet", note: "", supportRequested: false }))}
                />
                <span>{a.body}{a.late ? <span className="ms-action-when"> · was due {shortDay(a.due!)}</span> : null}</span>
              </label>
              <span className="ms-action-tag">{a.linked ? "From your session · for your Next Step" : "From your session"}</span>
            </li>
          ))}
          {plan ? (
            <li>
              <label>
                <input type="checkbox" checked={plan.done} disabled={busy} onChange={(e) => run(() => (plan.moveId ? setMoveDone(plan.moveId, e.target.checked) : setPlanActionDone({ goalId: plan.goalId, body: plan.body, done: e.target.checked })))} />
                <span>{plan.body}</span>
              </label>
              <span className="ms-action-tag">From your Next Step</span>
            </li>
          ) : null}
          {own.map((a) => (
            <li key={a.id}>
              <label>
                <input type="checkbox" checked={!!a.done_at} disabled={busy} onChange={(e) => run(() => setOwnActionDone(a.id, e.target.checked))} />
                <span>{a.body}</span>
              </label>
              <button type="button" className="ms-action-remove" disabled={busy} aria-label={`Remove “${a.body}”`} onClick={() => run(() => removeOwnAction(a.id))}>×</button>
            </li>
          ))}
        </ul>
      ) : null}
      {adding ? (
        <div className="ms-action-add">
          <label htmlFor="new-action" className="sr-only">A meaningful action for today</label>
          <input id="new-action" type="text" maxLength={200} value={body} onChange={(e) => setBody(e.target.value)} placeholder="A meaningful action for today" autoFocus />
          {goals.length ? (
            <select aria-label="Which goal it serves" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              {goals.map((g) => <option key={g.id} value={g.id}>For: {g.title}</option>)}
              <option value="">Not linked to a goal</option>
            </select>
          ) : null}
          <div className="identity-actions">
            <button type="button" className="btn btn-g" disabled={busy || !body.trim()} onClick={add}>{busy ? "Saving…" : "Add"}</button>
            <button type="button" className="au-text-link as-btn" disabled={busy} onClick={() => { setAdding(false); setBody(""); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className="au-text-link as-btn" onClick={() => setAdding(true)}>+ Add an action</button>
      )}
      {error ? <p className="clear-err" role="alert">{error}</p> : null}
    </div>
  );
}

const shortDay = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
