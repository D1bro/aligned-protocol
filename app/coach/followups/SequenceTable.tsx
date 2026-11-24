import Link from "next/link";
import type { SequencePerson } from "@/lib/followups";
import type { DayState } from "@/lib/followup-content";

// Console → Follow-up emails: one row per person in the sequence, with where
// each of their four emails stands.

const short = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function Cell({ d }: { d: DayState }) {
  if (d.state === "sent") return <span className="fu-cell is-sent">✓ {short(d.date)}</span>;
  if (d.state === "failed") return <span className="fu-cell is-failed" title={d.reason ?? undefined}>Failed {short(d.date)}</span>;
  if (d.state === "next") return <span className="fu-cell is-next">Next send</span>;
  if (d.state === "due") return <span className="fu-cell">{short(d.date)}</span>;
  return <span className="fu-cell is-skipped" title={d.reason}>Skipped</span>;
}

export function statusOf(p: SequencePerson): { text: string; tone: "on" | "done" | "off" | "wait" } {
  if (p.stopped) return { text: `Stopped: ${p.stopped.toLowerCase()}`, tone: "off" };
  if (!p.days) return { text: "Waiting for their audit", tone: "wait" };
  if (p.days.every((d) => d.state === "sent" || d.state === "failed" || d.state === "skipped")) return { text: "Finished", tone: "done" };
  return { text: "In progress", tone: "on" };
}

export type SequenceRow = { p: SequencePerson; s: ReturnType<typeof statusOf> };

export function SequenceTable({ rows }: { rows: SequenceRow[] }) {
  return (
    <div className="fu-table" role="table" aria-labelledby="fu-who">
      <div className="fu-row head" role="row">
        <span role="columnheader">Person</span>
        <span role="columnheader">Started</span>
        <span role="columnheader">Day 1</span>
        <span role="columnheader">Day 3</span>
        <span role="columnheader">Day 7</span>
        <span role="columnheader">Day 10</span>
        <span role="columnheader">Status</span>
      </div>
      {rows.map(({ p, s }) => (
        <div className="fu-row" role="row" key={p.id}>
          <span role="cell" className="fu-who">
            <Link href={`/coach/clients/${p.id}?tab=details`}><b>{p.name?.trim() || p.email || "No name"}</b></Link>
            <em>{p.stepId ? "Next Step set" : "No Next Step yet"}{p.score != null ? ` · ${p.score}/100` : ""}</em>
          </span>
          <span role="cell" className="fu-start"><em className="fu-label">Started</em>{p.start ? short(p.start) : "—"}</span>
          {p.days
            ? p.days.map((d) => (
                <span role="cell" key={d.day}>
                  <em className="fu-label">Day {d.day}</em>
                  {/* Once stopped, only what actually went is shown. */}
                  {p.stopped && d.state !== "sent" && d.state !== "failed" ? <span className="fu-cell">—</span> : <Cell d={d} />}
                </span>
              ))
            : [1, 3, 7, 10].map((d) => (
                <span role="cell" key={d}><em className="fu-label">Day {d}</em><span className="fu-cell">—</span></span>
              ))}
          <span role="cell" className={`fu-status is-${s.tone}`}>{s.text}</span>
        </div>
      ))}
    </div>
  );
}
