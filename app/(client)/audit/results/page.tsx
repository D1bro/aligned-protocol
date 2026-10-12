import Link from "next/link";
import { redirect } from "next/navigation";
import { getLatestCompletedAudit, getAuditWithResponses, getLifeAreas } from "@/lib/actions/audit";
import { createClient } from "@/lib/supabase/server";
import { AREA_GUIDES } from "@/lib/audit-guides";
import { SnapshotView, type SnapshotArea } from "@/components/audit/SnapshotView";

export default async function ResultsPage() {
  const audit = await getLatestCompletedAudit();
  if (!audit) redirect("/audit");

  // is_anonymous tells us whether this is a guest who took the audit without
  // an account yet, or someone with a real, permanent account. Guests get the
  // same full results everyone else does — just with a prompt to save them.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isGuest = user?.is_anonymous ?? false;

  const [{ responses }, areas] = await Promise.all([getAuditWithResponses(audit.id), getLifeAreas()]);
  const byArea = new Map(responses.map((r) => [r.life_area_id, r]));

  // Built from the person's actual saved answers, in audit order.
  const snapshot: SnapshotArea[] = areas.map((a) => {
    const r = byArea.get(a.id);
    return {
      name: a.name,
      score: (r?.satisfaction_score as number | undefined) ?? 0,
      note: (r?.note as string | null | undefined) ?? null,
      prompt: AREA_GUIDES[a.sort_order]?.prompt ?? null,
    };
  });
  const focusIdx = areas.findIndex((a) => a.id === audit.focus_area_id);
  const focusIndex = focusIdx === -1 ? null : focusIdx;
  const total = snapshot.reduce((sum, a) => sum + a.score, 0);

  return (
    <div className="page au-results">
      <div className="au-results-head">
        <div>
          <div className="eyebrow"><span className="eydot" /> Your Aligned snapshot</div>
          <h1>Here&rsquo;s where you stand.</h1>
          <p className="lead">
            Ten areas. One honest picture. A clear place to start.{" "}
            {isGuest
              ? "Create a free account to save your snapshot to your profile and come back to it any time."
              : "It’s saved to your profile so you can come back to it, reflect on it and track how it changes."}
          </p>
        </div>
        <div className="au-total" aria-label={`Overall ${total} out of 100`}>
          <b>{total}</b>
          <span>overall, out of 100</span>
        </div>
      </div>

      <SnapshotView areas={snapshot} focusIndex={focusIndex} />

      <div className="au-result-actions">
        <p className="au-focus-line">
          {focusIndex !== null ? (
            <>
              Your first focus: <strong>{snapshot[focusIndex].name}</strong>
            </>
          ) : (
            "No first focus chosen for this audit."
          )}
        </p>
        {isGuest ? (
          <div className="au-save">
            <span>Right now this snapshot is only saved in this browser.</span>
            <Link href="/login?signup=1" className="btn btn-p">Create a free account to save it</Link>
          </div>
        ) : (
          <Link href="/" className="btn btn-p">Go to my profile</Link>
        )}
      </div>
    </div>
  );
}
