// The quarter at a glance: the audit, each monthly check-in and the next
// audit, laid out from the start. Reached points show their score; upcoming
// ones show their date and sit on the target line, so even on day one it
// reads as the road ahead rather than an empty chart.

export type Milestone = {
  kind: "audit" | "checkin" | "next-checkin" | "next-audit";
  date: string; // ISO
  score: number | null; // null = not reached yet
};

export function buildMilestones({
  auditDate,
  auditScore,
  checkIns,
  nextAuditDue,
}: {
  auditDate: string;
  auditScore: number;
  checkIns: { created_at: string; area_score: number }[];
  nextAuditDue: Date;
}): Milestone[] {
  const done: Milestone[] = [
    { kind: "audit", date: auditDate, score: auditScore },
    ...checkIns.map((c) => ({ kind: "checkin" as const, date: c.created_at, score: c.area_score })),
  ];
  const upcoming: Milestone[] = [];
  const cursor = new Date(done[done.length - 1].date);
  for (let i = 0; i < 3; i++) {
    cursor.setMonth(cursor.getMonth() + 1);
    if (cursor >= nextAuditDue) break;
    upcoming.push({ kind: "next-checkin", date: cursor.toISOString(), score: null });
  }
  upcoming.push({ kind: "next-audit", date: nextAuditDue.toISOString(), score: null });
  // Keep it readable: the most recent reached points plus what's ahead.
  return [...done.slice(-4), ...upcoming];
}

const short = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const KIND_LABEL: Record<Milestone["kind"], string> = {
  audit: "Audit",
  checkin: "Check-in",
  "next-checkin": "Check-in",
  "next-audit": "Audit (suggested)",
};

export function ProgressPath({ milestones, target, compact = false }: { milestones: Milestone[]; target: number; compact?: boolean }) {
  const W = 640;
  const H = compact ? 150 : 170;
  const padX = 46;
  const top = 30;
  const bottom = 46;
  const x = (i: number) => (milestones.length === 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (milestones.length - 1));
  const y = (s: number) => top + ((10 - s) * (H - top - bottom)) / 9;

  const reached = milestones.map((m, i) => ({ m, i })).filter(({ m }) => m.score !== null);
  const last = reached[reached.length - 1];
  const solid = reached.map(({ m, i }, k) => `${k ? "L" : "M"}${x(i).toFixed(1)} ${y(m.score as number).toFixed(1)}`).join(" ");
  const firstUpcoming = milestones.findIndex((m) => m.score === null);
  const ahead =
    last && firstUpcoming !== -1
      ? `M${x(last.i).toFixed(1)} ${y(last.m.score as number).toFixed(1)} L${x(firstUpcoming).toFixed(1)} ${y(target).toFixed(1)} L${x(milestones.length - 1).toFixed(1)} ${y(target).toFixed(1)}`
      : "";

  return (
    <svg
      className={compact ? "progress-path compact" : "progress-path"}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Progress towards ${target}: ${milestones
        .map((m) => `${KIND_LABEL[m.kind]} ${short(m.date)}${m.score !== null ? ` ${m.score}` : " upcoming"}`)
        .join(", ")}.`}
    >
      <line x1={padX - 20} x2={W - padX + 20} y1={y(target)} y2={y(target)} className="pp-target" />
      <text x={padX - 20} y={y(target) - 10} textAnchor="start" className="pp-target-label" dx={milestones.length > 1 ? (W - 2 * padX) / (milestones.length - 1) / 2 : 0}>
        Target {target}
      </text>
      {ahead ? <path d={ahead} className="pp-ahead" /> : null}
      {reached.length > 1 ? <path d={solid} className="pp-line" /> : null}
      {milestones.map((m, i) => {
        const isLast = last && last.i === i;
        if (m.score === null) {
          return (
            <g key={i}>
              <circle cx={x(i)} cy={y(target)} r={m.kind === "next-audit" ? 8 : 6} className={`pp-future ${m.kind}`} />
              <text x={x(i)} y={H - 26} textAnchor="middle" className="pp-kind future">{KIND_LABEL[m.kind]}</text>
              <text x={x(i)} y={H - 10} textAnchor="middle" className="pp-date">{short(m.date)}</text>
            </g>
          );
        }
        return (
          <g key={i}>
            <circle cx={x(i)} cy={y(m.score)} r={isLast ? 9 : 6.5} className={isLast ? "pp-dot now" : "pp-dot"} />
            <text x={x(i)} y={y(m.score) - 15} textAnchor="middle" className="pp-score">{m.score}</text>
            <text x={x(i)} y={H - 26} textAnchor="middle" className="pp-kind">{isLast ? "Now" : KIND_LABEL[m.kind]}</text>
            <text x={x(i)} y={H - 10} textAnchor="middle" className="pp-date">{short(m.date)}</text>
          </g>
        );
      })}
    </svg>
  );
}
