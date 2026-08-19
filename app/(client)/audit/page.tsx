import { redirect } from "next/navigation";
import { startOrResumeAudit, getAuditWithResponses, getLifeAreas } from "@/lib/actions/audit";

// Entry point: resumes an in-progress audit at the first unanswered area, or
// starts a fresh one at area 1. Never renders anything itself.
export default async function AuditEntryPage() {
  const auditId = await startOrResumeAudit();
  const [{ responses }, areas] = await Promise.all([getAuditWithResponses(auditId), getLifeAreas()]);

  const answeredIds = new Set(responses.map((r) => r.life_area_id));
  const firstUnanswered = areas.find((a) => !answeredIds.has(a.id));
  const targetStep = firstUnanswered ? firstUnanswered.sort_order : areas.length; // all answered -> land on last

  redirect(`/audit/${targetStep}`);
}
