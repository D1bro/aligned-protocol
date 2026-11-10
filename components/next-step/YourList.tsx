import Link from "next/link";
import type { MemberCoaching } from "@/lib/actions/member-coaching";
import { latestProgress } from "@/lib/daily-log";

const PROGRESS: Record<string, string> = { tried: "Tried it", partly: "Partly", done: "Done", not_yet: "Not yet" };
const short = (ymd: string) => new Date(`${ymd.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

// Your list (Duane, 10 Nov 2026): what you agreed in your sessions, still
// open, with the ones for your Next Step marked. Due ones also show in Today.
// The accountability list your coach sees too.
export function YourList({ coaching, activeGoalIds }: { coaching: MemberCoaching; activeGoalIds: string[] }) {
  const latest = coaching.summaries[0] ?? null;
  const open = coaching.commitments.filter((c) => c.owner === "client" && c.status === "open");
  const items = open
    .map((c) => ({ c, u: latestProgress(coaching.updates, c.id) }))
    .filter(({ u }) => u?.progress !== "done")
    .sort((a, b) => Number(b.c.summary_id === latest?.id) - Number(a.c.summary_id === latest?.id));
  if (!items.length) return null;
  const sessionOf = (summaryId: string) => coaching.summaries.find((s) => s.id === summaryId)?.published_at ?? null;
  return (
    <section className="au-sum-card ns-list" aria-labelledby="ns-list-h">
      <div className="ns-card-top">
        <h2 id="ns-list-h" className="au-detail-k">Your list{latest ? ` · from ${short(latest.published_at)}` : ""}</h2>
        <Link href="/coaching" className="au-text-link">All of it on Coaching</Link>
      </div>
      <ul>
        {items.map(({ c, u }) => {
          const from = c.summary_id !== latest?.id ? sessionOf(c.summary_id) : null;
          return (
            <li key={c.id}>
              <span className={`ns-list-dot${c.goal_id && activeGoalIds.includes(c.goal_id) ? " on" : ""}`} aria-hidden="true" />
              <span className="ns-list-body">
                {c.body}
                <span className="au-small">
                  {c.goal_id && activeGoalIds.includes(c.goal_id) ? " · for your Next Step" : ""}
                  {c.due_date ? ` · due ${short(c.due_date)}` : ""}
                  {from ? ` · from ${short(from)}` : ""}
                  {u ? ` · ${PROGRESS[u.progress] ?? u.progress}` : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="au-small">Tick them in Today on My Space when they&rsquo;re due. Your coach sees this list too.</p>
    </section>
  );
}
