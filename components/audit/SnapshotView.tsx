"use client";

import { useState } from "react";
import { LifeMap } from "./LifeMap";

export type SnapshotArea = { name: string; short: string; score: number; note: string | null; prompt: string | null };

// The snapshot: the life map beside a list of all ten areas, each with its own
// bar, and a panel showing the person's own notes for whichever area they pick.
// Opens on the highlighted area (their starting point).
export function SnapshotView({
  areas,
  highlightIndex,
  highlightLabel = "Starting point",
  total,
}: {
  areas: SnapshotArea[];
  highlightIndex: number | null;
  highlightLabel?: string;
  total?: number;
}) {
  const [active, setActive] = useState<number>(highlightIndex ?? 0);
  const current = areas[active];

  return (
    <div className="au-result-grid">
      <div className="au-chart">
        <div className="au-chart-top">
          <strong>Your life, mapped</strong>
          {total !== undefined ? <span>Overall {total} / 100</span> : <span>Scale 1–10</span>}
        </div>
        <LifeMap
          scores={areas.map((a) => a.score)}
          names={areas.map((a) => a.name)}
          labels={areas.map((a) => a.short)}
          highlightIndex={highlightIndex}
          activeIndex={active}
        />
        <p className="au-chart-caption">The centre is 0 and the outer ring is 10. The further out, the more aligned that area feels.</p>
      </div>

      <div>
        <ol className="au-list">
          {areas.map((a, i) => (
            <li key={a.name}>
              <button type="button" aria-pressed={i === active} onClick={() => setActive(i)}>
                <span className="au-list-row">
                  <span className="au-list-name">
                    {a.name}
                    {i === highlightIndex ? <span className="au-focus-tag">{highlightLabel}</span> : null}
                  </span>
                  <span className="au-list-score">{a.score}/10</span>
                </span>
                <span className="au-bar-track" aria-hidden="true">
                  <span className={i === highlightIndex ? "au-bar-fill focus" : "au-bar-fill"} style={{ width: `${a.score * 10}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="au-detail" aria-live="polite">
          <h3>
            {current.name} · {current.score}/10
          </h3>
          {current.note ? (
            <>
              <p className="au-detail-k">Your notes</p>
              <p className="au-detail-note">{current.note}</p>
            </>
          ) : (
            <p className="au-detail-empty">
              No notes for this area.{current.prompt ? ` Something to reflect on: ${current.prompt}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
