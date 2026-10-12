"use client";

import { useState } from "react";
import type { GuideClip } from "@/lib/audit-guides";
import { GuideVideo } from "./GuideVideo";
import { StartingPoint, type StartArea } from "./StartingPoint";
import { SnapshotView, type SnapshotArea } from "./SnapshotView";

// Keeps the starting point and the snapshot in step: whichever area the
// person chooses to start with is the one highlighted on the map and list.
export function ResultsBody({
  auditId,
  startAreas,
  snapshot,
  initialAreaId,
  initialAnswer,
  isGuest,
  total,
  video,
}: {
  auditId: string;
  startAreas: StartArea[];
  snapshot: SnapshotArea[];
  initialAreaId: string;
  initialAnswer: string;
  isGuest: boolean;
  total: number;
  video: GuideClip;
}) {
  const [chosenId, setChosenId] = useState(initialAreaId);
  const highlightIndex = startAreas.findIndex((a) => a.id === chosenId);

  return (
    <>
      <section className="au-start-grid" aria-label="Your starting point">
        <StartingPoint
          auditId={auditId}
          areas={startAreas}
          chosenId={chosenId}
          onChoose={setChosenId}
          initialAnswer={initialAnswer}
          isGuest={isGuest}
        />
        <GuideVideo clip={video} caption="A word from Duane on what to do with your snapshot." />
      </section>

      <section className="au-snap" aria-labelledby="au-snap-h">
        <h2 id="au-snap-h" className="sec-head">Your snapshot</h2>
        <SnapshotView key={highlightIndex} areas={snapshot} highlightIndex={highlightIndex} total={total} />
      </section>
    </>
  );
}
