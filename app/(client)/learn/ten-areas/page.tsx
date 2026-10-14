import Link from "next/link";
import { TEN_AREAS, TEN_AREAS_INTRO, TEN_AREAS_OVERLAPS } from "@/lib/learn-content";

// Optional orientation: what the ten areas are, and how they overlap.
export default function TenAreasPage() {
  return (
    <>
      <div className="topbar">
        <Link href="/learn" className="tb-back">← Academy</Link>
        <span className="tb-label">Optional guide</span>
      </div>
      <article className="page au-page learn-lesson">
        <div className="eyebrow"><span className="eydot" /> Optional guide</div>
        <h1 className="au-latest-h">Understanding your ten areas</h1>
        <p className="draft-tag">Draft</p>
        <div className="learn-body">
          {TEN_AREAS_INTRO.map((p, i) => <p key={i}>{p}</p>)}
        </div>

        <h2 className="sec-head">The ten areas</h2>
        <dl className="areas-guide">
          {TEN_AREAS.map((a, i) => (
            <div key={a.name}>
              <dt>
                <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span> {a.name}
              </dt>
              <dd>
                <b>{a.focus}</b>
                {a.distinction}
              </dd>
            </div>
          ))}
        </dl>

        <h2 className="sec-head">Where they overlap</h2>
        <ul className="areas-overlaps">
          {TEN_AREAS_OVERLAPS.map((o) => (
            <li key={o.pair}>
              <b>{o.pair}</b>
              <span>{o.text}</span>
            </li>
          ))}
        </ul>

        <p className="au-small learn-more">
          This guide is optional. Go back to{" "}
          <Link href="/learn/clarity-and-direction/seeing-where-you-are" className="au-text-link">Seeing where you are</Link>, or
          look at <Link href="/audit/results" className="au-text-link">your snapshot</Link>.
        </p>
      </article>
    </>
  );
}
