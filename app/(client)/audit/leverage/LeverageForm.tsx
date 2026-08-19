"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFocusArea, completeAudit } from "@/lib/actions/audit";
import type { LifeArea } from "@/lib/actions/audit";

export function LeverageForm({
  auditId,
  areas,
  initialFocusAreaId,
}: {
  auditId: string;
  areas: LifeArea[];
  initialFocusAreaId: string | null;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(initialFocusAreaId);
  const [pending, startTransition] = useTransition();

  function finish() {
    if (!picked) return;
    const area = areas.find((a) => a.id === picked);
    if (!area) return;
    startTransition(async () => {
      await setFocusArea(auditId, area.id, area.name);
      await completeAudit(auditId); // redirects to /audit/results
    });
  }

  return (
    <>
      <div className="topbar">
        <button className="tb-back" onClick={() => router.push(`/audit/${areas.length}`)}>← Back</button>
        <span className="tb-label">One more question</span>
      </div>
      <div className="progbar"><div className="progfill" style={{ width: "100%" }} /></div>

      <div className="page">
        <div className="eyebrow"><span className="eydot" /> One more question</div>
        <h1>If one of these improved, which would help the others most?</h1>
        <p className="lead">Pick the one area that, if it moved, would make the rest easier to shift too.</p>

        <div className="area-grid">
          {areas.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className="area-card"
              onClick={() => setPicked(a.id)}
              style={picked === a.id ? { borderColor: "var(--gold)" } : undefined}
              aria-pressed={picked === a.id}
            >
              <span className="area-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="area-info">
                <span className="area-name">{a.name}</span>
              </span>
              <span
                aria-hidden="true"
                style={{
                  width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                  border: `1.5px solid ${picked === a.id ? "var(--gold)" : "var(--bdr2)"}`,
                  background: picked === a.id ? "var(--gold)" : "transparent",
                }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="foot-nav">
        <span className="tb-label">{picked ? "Selected" : "Choose one to continue"}</span>
        <button className="btn btn-p" disabled={!picked || pending} onClick={finish}>
          {pending ? "Finishing…" : "See my score"}
        </button>
      </div>
    </>
  );
}
