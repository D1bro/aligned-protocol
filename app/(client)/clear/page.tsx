import Link from "next/link";
import { redirect } from "next/navigation";
import { getLatestCompletedAudit, getLifeAreas, getAuditWithResponses } from "@/lib/actions/audit";
import { getOrCreateClearPlan, getGoalForPlan, getClearPlanForAudit } from "@/lib/actions/clear";
import { ClearWizard } from "./ClearWizard";

// CLEAR works on one area. Older audits chose it at the end of the audit
// (audits.focus_area_id); now the person chooses it here, at the start of
// CLEAR, and it's stored on the CLEAR plan itself.
export default async function ClearPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area: picked } = await searchParams;
  const audit = await getLatestCompletedAudit();
  if (!audit) redirect("/audit");

  const [areas, existing] = await Promise.all([getLifeAreas(), getClearPlanForAudit(audit.id)]);
  const areaId =
    existing?.life_area_id ??
    audit.focus_area_id ??
    (picked && areas.some((a) => a.id === picked) ? picked : null);
  const area = areaId ? areas.find((a) => a.id === areaId) : undefined;

  if (!area) {
    const { responses } = await getAuditWithResponses(audit.id);
    const scoreByArea = new Map(responses.map((r) => [r.life_area_id, r.satisfaction_score as number]));
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
                <Link href={`/clear?area=${a.id}`}>
                  <span className="au-list-i">{String(i + 1).padStart(2, "0")}</span>
                  <span className="au-list-name">
                    {a.name}
                    {s === lowest ? <span className="au-low-tag">Lowest score</span> : null}
                  </span>
                  <span className="au-list-score">{s}/10</span>
                </Link>
              </li>
            );
          })}
        </ol>
        <p className="au-foot">You&rsquo;ll work on one area at a time. You can start CLEAR again after your next audit.</p>
      </div>
    );
  }

  const plan = await getOrCreateClearPlan(audit.id, area.id);
  const goal = await getGoalForPlan(plan.id);

  return <ClearWizard area={area} plan={plan} goal={goal} />;
}
