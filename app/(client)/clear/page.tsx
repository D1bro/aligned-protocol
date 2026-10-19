import { redirect } from "next/navigation";
import { getLatestCompletedAudit, getLifeAreas, getAuditWithResponses } from "@/lib/actions/audit";
import { getOrCreateClearPlan, getGoalForPlan, getClearPlanForAudit, chooseClearArea } from "@/lib/actions/clear";
import { nextAuditDue } from "@/lib/audit-schedule";
import { ClearWizard } from "./ClearWizard";
import { ClearIntro } from "./ClearIntro";
import { ClearDashboard } from "./ClearDashboard";
import { getCheckIns, getAllGoals } from "@/lib/actions/checkins";
import { getMainGoal } from "@/lib/actions/goals";
import { getReminderPreference, remindersConfigured } from "@/lib/actions/preferences";

const filled = (v: string | null | undefined) => !!v?.trim();

// My plan answers: why does this matter, and how will I follow through?
// With an active main goal (lib/actions/goals.ts) it shows that goal's plan —
// the same goal My profile shows. Otherwise, CLEAR for the latest audit,
// in four states:
//  1. no area yet (or ?choose=1 before starting) -> choose where to start
//  2. area chosen, not started                    -> introduction (echoes the area)
//  3. in progress (or ?edit=1)                    -> the five steps
//  4. finished                                    -> the plan dashboard
// The area comes from the snapshot's starting point (stored on the CLEAR
// plan) or, for audits taken before that, the old end-of-audit focus.
export default async function ClearPage({
  searchParams,
}: {
  searchParams: Promise<{ choose?: string; start?: string; edit?: string; new?: string; latest?: string; welcome?: string }>;
}) {
  // ?edit=N opens CLEAR at step N (review / adjust); ?new=1 starts a fresh
  // goal on the same plan once the last one is done; ?latest=1 opens CLEAR
  // for the latest audit while another goal is still the main one.
  const { choose, start, edit, new: newGoal, latest, welcome } = await searchParams;
  const editStep = edit ? Math.min(5, Math.max(1, Number(edit) || 1)) : null;
  const audit = await getLatestCompletedAudit();
  if (!audit) redirect("/audit");

  const main = choose || start || newGoal || latest ? null : await getMainGoal();
  if (main && main.plan && main.area) {
    const { goal, plan, area } = main;
    const finished = filled(goal.frequency) && filled(goal.success_criteria);
    if (finished && !editStep) {
      const [allGoals, latestPlan, configured, remindersOn] = await Promise.all([
        getAllGoals(),
        getClearPlanForAudit(audit.id),
        remindersConfigured(),
        getReminderPreference(),
      ]);
      return (
        <ClearDashboard
          area={area}
          score={main.baselineScore ?? 0}
          plan={plan}
          goal={goal}
          nextAuditDue={nextAuditDue(audit.completed_at)}
          auditDate={main.baselineDate ?? audit.completed_at}
          checkIns={main.checkIns}
          otherGoals={allGoals.filter((g) => g.id !== goal.id)}
          isMain
          newerAudit={plan.audit_id !== audit.id && !latestPlan ? audit.completed_at : null}
          remindersOn={configured ? remindersOn : null}
        />
      );
    }
    const scoreMap = new Map(main.responses.map((r) => [r.life_area_id, r.satisfaction_score]));
    const allAreas = await getLifeAreas();
    const wellbeing = allAreas.find((a) => a.name === "Emotional Wellbeing");
    return (
      <ClearWizard
        area={area}
        plan={plan}
        goal={goal}
        score={main.baselineScore ?? 0}
        auditNote={main.baselineNote}
        lowWellbeing={wellbeing ? (scoreMap.get(wellbeing.id) ?? 10) <= 3 : false}
        nextAuditDue={nextAuditDue(audit.completed_at).toISOString()}
        startAtStep={editStep}
      />
    );
  }

  const [areas, existing, { responses }] = await Promise.all([
    getLifeAreas(),
    getClearPlanForAudit(audit.id),
    getAuditWithResponses(audit.id),
  ]);
  const scoreByArea = new Map(responses.map((r) => [r.life_area_id, r.satisfaction_score as number]));
  const started = Boolean(
    existing && (filled(existing.current_reality) || filled(existing.life_vision) || filled(existing.emotional_blocks))
  );
  const areaId = existing?.life_area_id ?? audit.focus_area_id ?? null;
  const area = areaId ? areas.find((a) => a.id === areaId) : undefined;

  if (!area || (choose === "1" && !started)) {
    const lowest = Math.min(...areas.map((a) => scoreByArea.get(a.id) ?? 10));
    return (
      <div className="page au-page">
        <div className="eyebrow"><span className="eydot" /> CLEAR — choose where to start</div>
        <h1>Which area do you want to develop first?</h1>
        <p className="lead">
          Pick the one that, if it improved, would make the others easier too. It doesn&rsquo;t have to be your lowest
          score — but if you choose a different area, it&rsquo;s worth noticing why.
        </p>
        <ol className="au-pick">
          {areas.map((a, i) => {
            const s = scoreByArea.get(a.id) ?? 0;
            return (
              <li key={a.id}>
                <form action={chooseClearArea.bind(null, audit.id, a.id)}>
                  <button type="submit" aria-current={a.id === areaId ? "true" : undefined}>
                    <span className="au-list-i">{String(i + 1).padStart(2, "0")}</span>
                    <span className="au-list-name">
                      {a.name}
                      {s === lowest ? <span className="au-low-tag">Lowest score</span> : null}
                    </span>
                    <span className="au-list-score">{s}/10</span>
                  </button>
                </form>
              </li>
            );
          })}
        </ol>
        <p className="au-foot">One goal is your main focus at a time. When it finishes, you can set the next one.</p>
      </div>
    );
  }

  const plan = await getOrCreateClearPlan(audit.id, area.id);
  const latestGoal = await getGoalForPlan(plan.id);
  const goal = newGoal === "1" && latestGoal?.status !== "active" ? null : latestGoal;
  const score = scoreByArea.get(area.id) ?? 0;
  const due = nextAuditDue(audit.completed_at);
  const finished = Boolean(goal && filled(goal.frequency) && filled(goal.success_criteria));

  if (finished && goal && !editStep) {
    const [checkIns, allGoals, configured, remindersOn] = await Promise.all([
      getCheckIns(goal.id),
      getAllGoals(),
      remindersConfigured(),
      getReminderPreference(),
    ]);
    return (
      <ClearDashboard
        area={area}
        score={score}
        plan={plan}
        goal={goal}
        nextAuditDue={due}
        auditDate={audit.completed_at}
        checkIns={checkIns}
        otherGoals={allGoals.filter((g) => g.id !== goal.id)}
        isMain={goal.status === "active"}
        newerAudit={null}
        remindersOn={configured ? remindersOn : null}
      />
    );
  }
  if (!started && !goal && start !== "1") {
    return <ClearIntro area={area} score={score} plan={plan} nextAuditDue={due} welcome={welcome === "1"} />;
  }
  const note = (responses.find((r) => r.life_area_id === area.id)?.note as string | null | undefined)?.trim() || null;
  const wellbeing = areas.find((a) => a.name === "Emotional Wellbeing");
  const lowWellbeing = wellbeing ? (scoreByArea.get(wellbeing.id) ?? 10) <= 3 : false;
  return (
    <ClearWizard
      area={area}
      plan={plan}
      goal={goal}
      score={score}
      auditNote={note}
      lowWellbeing={lowWellbeing}
      nextAuditDue={due.toISOString()}
      startAtStep={editStep}
    />
  );
}
