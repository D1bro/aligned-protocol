import { notFound } from "next/navigation";
import { getLifeAreas, getAuditWithResponses, startOrResumeAudit } from "@/lib/actions/audit";
import { AreaForm } from "./AreaForm";

export default async function AuditAreaPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const stepNum = Number(step);

  const areas = await getLifeAreas();
  if (!Number.isInteger(stepNum) || stepNum < 1 || stepNum > areas.length) notFound();

  const area = areas[stepNum - 1];
  const auditId = await startOrResumeAudit();
  const { responses } = await getAuditWithResponses(auditId);
  const existing = responses.find((r) => r.life_area_id === area.id);

  return (
    <AreaForm
      auditId={auditId}
      area={area}
      step={stepNum}
      totalSteps={areas.length}
      initialSatisfaction={existing?.satisfaction_score ?? null}
      initialImportance={existing?.importance_score ?? null}
      initialNote={existing?.note ?? ""}
    />
  );
}
