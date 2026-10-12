import Link from "next/link";
import { MUSINGS } from "@/lib/learn-content";

// Duane's Musings: short reflective pieces, each ending in one question.
export default function MusingsPage() {
  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> Duane&rsquo;s Musings</div>
      <h1 className="au-latest-h">Something to sit with.</h1>
      <p className="lead">Short reflections on alignment, identity and change. Read one, then take its question with you.</p>
      <ul className="learn-cards">
        {MUSINGS.map((m) => (
          <li key={m.slug}>
            <Link href={`/musings/${m.slug}`}>
              {m.draft ? <span className="draft-tag">Draft</span> : null}
              <b>{m.title}</b>
              <span>{m.summary}</span>
              <em>Read →</em>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
