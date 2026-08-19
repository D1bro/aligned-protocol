import { redirect } from "next/navigation";
import { getLifeAreas, getAuditWithResponses, startOrResumeAudit } from "@/lib/actions/audit";
import { LeverageForm } from "./LeverageForm";

export default async function LeveragePage() {
  const auditId = await startOrResumeAudit();
  const [areas, { audit, responses }] = await Promise.all([getLifeAreas(), getAuditWithResponses(auditId)]);

  if (responses.length < areas.length) redirect("/audit");

  return <LeverageForm auditId={auditId} areas={areas} initialFocusAreaId={audit.focus_area_id} />;
}
