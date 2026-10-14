import Link from "next/link";
import { getClientDetail } from "@/lib/actions/coach";
import { getLifeAreas } from "@/lib/actions/audit";
import { AREA_SHORT_NAMES } from "@/lib/audit-guides";
import { LifeMap } from "@/components/audit/LifeMap";
import { DID_IT_LABELS } from "@/lib/checkin-labels";
import { cleanReality } from "@/lib/clear-text";
import type { CheckIn } from "@/lib/actions/checkins";
import { SessionNoteForm } from "./SessionNoteForm";
import { PATHS } from "@/lib/learn-content";

const LESSON_TITLE = new Map(PATHS.flatMap((p) => p.lessons.map((l) => [l.slug, l.title] as const)));

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ client, audits, goals, notes, startingArea, latestDetail, reflections }, areas] = await Promise.all([getClientDetail(id), getLifeAreas()]);

  const latest = audits[0];
  const byArea = new Map((latestDetail?.responses ?? []).map((r) => [r.life_area_id, r]));
  const scores = areas.map((a) => byArea.get(a.id)?.satisfaction_score ?? 0);
  const plan = latestDetail?.plan as Record<string, string | string[] | null> | null;
  const goal = latestDetail?.goal as Record<string, string | null> | null;
  const startIdx = plan?.life_area_id ? areas.findIndex((a) => a.id === plan.life_area_id) : -1;
  const ifThen = plan?.if_obstacle && plan?.if_response ? `If ${plan.if_obstacle}, then I’ll ${plan.if_response}.` : null;

  return (
    <div className="page">
      <Link href="/coach" className="tb-back" style={{ marginBottom: "1rem", display: "inline-flex" }}>
        ← Back to roster
      </Link>
      <div className="eyebrow"><span className="eydot" /> Client</div>
      <h1>{client.full_name || "Unnamed client"}</h1>
      <p className="body-t" style={{ marginBottom: "1.5rem" }}>{client.email}</p>

      <div className="stat-grid">
        <div className="sc">
          <div className="sc-l">Latest score</div>
          <div className="sc-v">{latest ? `${latest.total_score}/100` : "—"}</div>
        </div>
        <div className="sc">
          <div className="sc-l">Starting area</div>
          <div className="sc-v" style={{ fontSize: 14 }}>{startingArea || "—"}</div>
        </div>
        <div className="sc">
          <div className="sc-l">Audits completed</div>
          <div className="sc-v">{audits.length}</div>
        </div>
        <div className="sc">
          <div className="sc-l">Active goals</div>
          <div className="sc-v">{goals.length}</div>
        </div>
      </div>

      {goals.length > 0 && (
        <>
          <div className="sec-head">Active goals</div>
          {goals.map((g) => (
            <div key={g.id} className="card" style={{ marginBottom: ".75rem" }}>
              <div className="hbox-l" style={{ marginBottom: 4 }}>
                {g.goal_type === "primary" ? "Primary" : "Supporting"}{g.focus_area ? ` · ${g.focus_area}` : ""}
              </div>
              <h3 style={{ margin: "0 0 .35rem" }}>{g.goal_title}</h3>
              {g.action_text ? <p className="body-t">{g.action_text}</p> : null}
            </div>
          ))}
        </>
      )}

      {latestDetail ? (
        <>
          <div className="sec-head">Latest audit{latest?.completed_at ? ` · ${new Date(latest.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}</div>
          <div className="coach-audit">
            <div className="au-chart">
              <LifeMap
                scores={scores}
                names={areas.map((a) => a.name)}
                labels={areas.map((a) => AREA_SHORT_NAMES[a.sort_order] ?? a.name)}
                highlightIndex={startIdx === -1 ? null : startIdx}
              />
            </div>
            <ol className="coach-answers">
              {areas.map((a, i) => (
                <li key={a.id}>
                  <div><b>{a.name}</b><span>{scores[i]}/10</span></div>
                  {byArea.get(a.id)?.note ? <p>{byArea.get(a.id)?.note}</p> : null}
                </li>
              ))}
            </ol>
          </div>

          {plan ? (
            <>
              <div className="sec-head">CLEAR plan{startIdx !== -1 ? ` · ${areas[startIdx].name}` : ""}</div>
              <div className="coach-clear">
                {[
                  ["Next step they named", plan.step_up_answer as string | null],
                  ["C · Current reality", cleanReality(plan.current_reality as string | null)],
                  ["L · Life vision (a 10)", plan.life_vision as string | null],
                  ["E · What’s in the way", [Array.isArray(plan.blocks) ? plan.blocks.join(", ") : null, plan.emotional_blocks as string | null].filter(Boolean).join(" — ")],
                  ["Tried before", plan.tried_before as string | null],
                  ["A · Goal", goal?.goal_title ?? null],
                  ["When", goal?.action_when ?? goal?.frequency ?? null],
                  ["R · Success looks like", goal?.success_criteria ?? null],
                  ["If it gets hard", ifThen],
                  ["Why it matters", goal?.motivation_text ?? null],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k as string}><span>{k}</span><p>{v}</p></div>
                  ))}
              </div>
            </>
          ) : null}

          {latestDetail.checkIns.length ? (
            <>
              <div className="sec-head">Check-ins</div>
              <ol className="checkin-list">
                {latestDetail.checkIns.map((c) => (
                  <li key={c.id}>
                    <div className="checkin-head">
                      <b>{new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</b>
                      <span>{DID_IT_LABELS[c.did_it as CheckIn["did_it"]]} · {c.area_score}/10 · {c.next_step}</span>
                    </div>
                    {c.helped ? <p><span>Helped:</span> {c.helped}</p> : null}
                    {c.got_in_way ? <p><span>Got in the way:</span> {c.got_in_way}</p> : null}
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </>
      ) : null}

      {reflections.length ? (
        <>
          <div className="sec-head">Academy reflections · shared with you</div>
          <ol className="checkin-list">
            {reflections.map((r) => (
              <li key={r.lesson_slug}>
                <div className="checkin-head">
                  <b>{LESSON_TITLE.get(r.lesson_slug) ?? r.lesson_slug}</b>
                  <span>{new Date(r.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
                </div>
                <p>{r.reflection}</p>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      <div className="sec-head">Session notes</div>
      <SessionNoteForm clientId={client.id} />

      {notes.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">◇</span>
          No session notes yet.
        </div>
      ) : (
        notes.map((n) => (
          <div key={n.id} className="track-row" style={{ marginTop: ".75rem" }}>
            <div className="track-head" style={{ cursor: "default" }}>
              <span>
                {new Date(n.session_date).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              {n.focus ? <span className="tb-label">{n.focus}</span> : null}
            </div>
            <div className="track-body">
              <p className="body-t">{n.note}</p>
              {n.next_actions ? (
                <p className="body-t" style={{ marginTop: ".5rem" }}>
                  <strong>Next:</strong> {n.next_actions}
                </p>
              ) : null}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
