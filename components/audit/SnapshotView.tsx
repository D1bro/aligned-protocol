"use client";

import { useState } from "react";
import { LifeMap } from "./LifeMap";

export type SnapshotArea = { name: string; score: number; note: string | null; prompt: string | null };

// The interactive part of the results: the life map (or the simpler bar
// layout, kept for comparison), the list of areas with their scores, and a
// detail panel showing the person's own notes for whichever area they pick.
export function SnapshotView({ areas, focusIndex }: { areas: SnapshotArea[]; focusIndex: number | null }) {
  const [view, setView] = useState<"map" | "bars">("map");
  const [active, setActive] = useState<number>(focusIndex ?? 0);
  const current = areas[active];

  const detail = (
    <div className="au-detail" aria-live="polite">
      <div className="eyebrow"><span className="eydot" /> {active === focusIndex ? "Your first focus" : "Explore an area"}</div>
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
  );

  const list = (
    <ol className="au-list">
      {areas.map((a, i) => (
        <li key={a.name}>
          <button type="button" aria-pressed={i === active} onClick={() => setActive(i)}>
            <span className="au-list-i">{String(i + 1).padStart(2, "0")}</span>
            <span className="au-list-name">
              {a.name}
              {i === focusIndex ? <span className="au-focus-tag">Focus</span> : null}
            </span>
            <span className="au-list-score">{a.score}/10</span>
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="au-snapshot">
      <div className="au-view-toggle" role="group" aria-label="Snapshot layout">
        <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>Life map</button>
        <button type="button" aria-pressed={view === "bars"} onClick={() => setView("bars")}>Bars</button>
      </div>

      {view === "map" ? (
        <div className="au-result-grid">
          <div className="au-chart">
            <div className="au-chart-top">
              <strong>Your life, mapped</strong>
              <span>Scale 1–10</span>
            </div>
            <LifeMap
              scores={areas.map((a) => a.score)}
              names={areas.map((a) => a.name)}
              focusIndex={focusIndex}
              activeIndex={active}
            />
            <p className="au-chart-caption">
              Each numbered spoke is one area. The centre is 0 and the outer ring is 10; each ring marks 2 points.
              {focusIndex !== null ? " The larger point is your chosen focus." : ""}
            </p>
          </div>
          <div>
            {list}
            {detail}
          </div>
        </div>
      ) : (
        <div className="au-result-grid bars">
          <div className="au-bars">
            {areas.map((a, i) => (
              <button key={a.name} type="button" className="au-bar" aria-pressed={i === active} onClick={() => setActive(i)}>
                <span className="au-bar-label">
                  <span>
                    <span className="au-list-i">{String(i + 1).padStart(2, "0")}</span> {a.name}
                    {i === focusIndex ? <span className="au-focus-tag">Focus</span> : null}
                  </span>
                  <span className="au-list-score">{a.score}/10</span>
                </span>
                <span className="au-bar-track">
                  <span className={i === focusIndex ? "au-bar-fill focus" : "au-bar-fill"} style={{ width: `${a.score * 10}%` }} />
                </span>
              </button>
            ))}
          </div>
          <div>{detail}</div>
        </div>
      )}
    </div>
  );
}
