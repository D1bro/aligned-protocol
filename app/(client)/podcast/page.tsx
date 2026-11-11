import Link from "next/link";
import { notFound } from "next/navigation";
import { SHOWN_EPISODES } from "@/lib/learn-content";

// The Aligned Podcast: conversations on alignment, identity and change.
export default function PodcastPage() {
  if (!SHOWN_EPISODES.length) notFound();
  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> The Aligned Podcast</div>
      <h1 className="au-latest-h">Listen and <em>reflect.</em></h1>
      <p className="lead">
        Conversations on alignment, identity and change. Each episode ends with one question to take into your week.
      </p>
      <ul className="learn-cards">
        {SHOWN_EPISODES.map((e) => (
          <li key={e.slug}>
            <Link href={`/podcast/${e.slug}`}>
              {e.draft ? <span className="draft-tag">Draft</span> : null}
              <span className="pod-num">Episode {e.number}</span>
              <b>{e.title}</b>
              <span>{e.summary}</span>
              <em>{e.audio || e.video ? `${e.minutes ? `${e.minutes} min · ` : ""}Listen →` : "Not recorded yet"}</em>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
