// Ten-area "life map": one spoke per area, scored outwards from the centre
// (0) to the outer ring (10). Rings mark every 2 points. Pure SVG, no state,
// so it renders on the server, in the snapshot, and in the welcome preview.

const C = 240; // centre
const R = 180; // radius of the outer ring (score 10)

function point(i: number, count: number, r: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
  return [C + Math.cos(a) * r, C + Math.sin(a) * r];
}

const pts = (list: [number, number][]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

export function LifeMap({
  scores,
  names,
  labels,
  compareScores,
  highlightIndex = null,
  activeIndex = null,
  title = "Life map of your ten alignment scores",
}: {
  scores: number[];
  names: string[];
  // Short text around the edge (e.g. "Money"); falls back to 01–10.
  labels?: string[];
  // An earlier audit, drawn as a dashed outline underneath for comparison.
  compareScores?: number[];
  highlightIndex?: number | null;
  activeIndex?: number | null;
  title?: string;
}) {
  const n = scores.length;
  const shape = scores.map((s, i) => point(i, n, (R * Math.max(0, Math.min(10, s))) / 10));

  return (
    <svg className="au-map" viewBox="-80 -6 640 492" role="img" aria-label={title}>
      {[2, 4, 6, 8, 10].map((ring) => (
        <polygon
          key={ring}
          points={pts(scores.map((_, i) => point(i, n, (R * ring) / 10)))}
          className={ring === 10 ? "au-map-ring outer" : "au-map-ring"}
        />
      ))}
      {scores.map((_, i) => {
        const [x, y] = point(i, n, R);
        const [lx, ly] = point(i, n, R + 22);
        const anchor = Math.abs(lx - C) < 8 ? "middle" : lx > C ? "start" : "end";
        const dy = ly < C - R ? -4 : ly > C + R ? 16 : 6;
        return (
          <g key={i}>
            <line x1={C} y1={C} x2={x} y2={y} className={i === highlightIndex ? "au-map-axis focus" : "au-map-axis"} />
            <text x={lx} y={ly + dy} textAnchor={anchor} className={i === highlightIndex ? "au-map-label focus" : "au-map-label"}>
              {labels?.[i] ?? String(i + 1).padStart(2, "0")}
            </text>
          </g>
        );
      })}
      {compareScores ? (
        <polygon
          points={pts(compareScores.map((s, i) => point(i, n, (R * Math.max(0, Math.min(10, s))) / 10)))}
          className="au-map-compare"
        />
      ) : null}
      <polygon points={pts(shape)} className="au-map-shape" />
      {shape.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === highlightIndex ? 9 : i === activeIndex ? 7.5 : 5.5}
          className={i === highlightIndex ? "au-map-dot focus" : i === activeIndex ? "au-map-dot active" : "au-map-dot"}
        >
          <title>{`${names[i]}: ${scores[i]} out of 10${i === highlightIndex ? " (your starting point)" : ""}`}</title>
        </circle>
      ))}
    </svg>
  );
}
