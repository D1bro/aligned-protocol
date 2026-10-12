// How an area has moved: the audit score, then each monthly check-in, with
// the target (their "next step") as a dashed line. Pure SVG.
export type ProgressPoint = { label: string; score: number };

export function ProgressLine({ points, target }: { points: ProgressPoint[]; target: number }) {
  const W = 600;
  const H = 190;
  const left = 40;
  const right = 24;
  const top = 26;
  const bottom = 40;
  const n = Math.max(points.length, 2);
  const inset = 36; // keep the first point clear of the scale numbers
  const x = (i: number) => left + inset + (i * (W - left - inset - right)) / (n - 1);
  const y = (s: number) => top + ((10 - s) * (H - top - bottom)) / 9;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg
      className="progress-line"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Progress: ${points.map((p) => `${p.label} ${p.score}`).join(", ")}. Target ${target}.`}
    >
      {[1, 5, 10].map((s) => (
        <g key={s}>
          <line x1={left} x2={W - right} y1={y(s)} y2={y(s)} className="pl-grid" />
          <text x={left - 10} y={y(s) + 4} textAnchor="end" className="pl-axis">{s}</text>
        </g>
      ))}
      <line x1={left} x2={W - right} y1={y(target)} y2={y(target)} className="pl-target" />
      <text x={W - right} y={y(target) - 8} textAnchor="end" className="pl-target-label">Target {target}</text>
      {points.length > 1 ? <path d={path} className="pl-path" /> : null}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.score)} r={p === last ? 7 : 5} className={p === last ? "pl-dot last" : "pl-dot"} />
          <text x={x(i)} y={y(p.score) - 13} textAnchor="middle" className="pl-score">{p.score}</text>
          <text x={x(i)} y={H - 12} textAnchor="middle" className="pl-label">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}
