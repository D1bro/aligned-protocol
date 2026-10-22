import Link from "next/link";
import { TOOLS } from "@/lib/learn-content";
import { getToolEntries } from "@/lib/actions/learn";
import { formatDate } from "@/lib/audit-schedule";

// Tools: short guided exercises. Answers are saved so they can come back to them.
export default async function ToolsPage() {
  const entries = await getToolEntries();
  const saved = new Map(entries.map((e) => [e.tool_slug, e.updated_at]));

  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> Tools</div>
      <h1 className="au-latest-h">Put it into <em>practice.</em></h1>
      <p className="lead">Short exercises for when you want to think something through. Your answers are private to you and saved, so you can come back and change them.</p>
      <ul className="learn-cards">
        {TOOLS.map((t) => (
          <li key={t.slug}>
            <Link href={`/tools/${t.slug}`}>
              <b>{t.title}</b>
              <span>{t.purpose}</span>
              <em>{saved.has(t.slug) ? `Saved ${formatDate(saved.get(t.slug)!)} · open →` : "Start →"}</em>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
