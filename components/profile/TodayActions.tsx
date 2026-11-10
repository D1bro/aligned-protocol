"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addOwnAction, removeOwnAction, setOwnActionDone, setPlanActionDone } from "@/lib/actions/planning";
import type { PlanAction } from "@/lib/planning";

// Today's actions: the plan's own action when it's planned (or already ticked)
// today, and any they've added, each linked to a goal where it fits. Ticking
// saves straight away.
export function TodayActions({
  plan,
  own,
  goals,
  defaultGoalId,
}: {
  plan: { goalId: string; body: string; done: boolean } | null;
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

  return (
    <div className="ms-actions">
      {plan || own.length ? (
        <ul className="ms-action-list">
          {plan ? (
            <li>
              <label>
                <input type="checkbox" checked={plan.done} disabled={busy} onChange={(e) => run(() => setPlanActionDone({ goalId: plan.goalId, body: plan.body, done: e.target.checked }))} />
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
