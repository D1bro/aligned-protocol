// The gold ring around a score. Previously this was hardcoded as a full
// circle no matter what the score was — the "progress" circle had no
// stroke-dasharray, so it always rendered 100% full. This version actually
// computes how much of the ring to fill based on score/100.
export function ScoreRing({
  score,
  size = 140,
  strokeWidth = 10,
  labelSize = 34,
  denomLabel = "/ 100",
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  labelSize?: number;
  denomLabel?: string;
}) {
  const pct = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const center = size / 2;

  return (
    <div className="ring-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--bg4)" strokeWidth={strokeWidth} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="ring-inner">
        <div className="ring-num" style={{ fontSize: labelSize }}>{Math.round(score)}</div>
        <div className="ring-den">{denomLabel}</div>
      </div>
    </div>
  );
}
