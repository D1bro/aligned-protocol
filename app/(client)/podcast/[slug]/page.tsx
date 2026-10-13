import Link from "next/link";
import { notFound } from "next/navigation";
import { EPISODES, clipFor } from "@/lib/learn-content";
import { GuideVideo } from "@/components/audit/GuideVideo";

export default async function EpisodePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const episode = EPISODES.find((e) => e.slug === slug);
  if (!episode) notFound();

  return (
    <>
      <div className="topbar">
        <Link href="/podcast" className="tb-back">← Podcast</Link>
        <span className="tb-label">The Aligned Podcast · Episode {episode.number}</span>
      </div>
      <article className="page au-page learn-lesson">
        <div className="eyebrow">
          <span className="eydot" /> Episode {episode.number}{episode.minutes ? ` · ${episode.minutes} min` : ""}
        </div>
        <h1 className="au-latest-h">{episode.title}</h1>
        {episode.draft ? <p className="draft-tag">Draft</p> : null}
        <p className="lead">{episode.summary}</p>

        {episode.audio ? (
          <figure className="pod-player">
            <audio src={episode.audio} controls preload="none" aria-label={`${episode.title} — podcast episode`} />
          </figure>
        ) : (
          <GuideVideo clip={clipFor(episode.slug, episode.title, episode.video)} soon="Episode coming soon" />
        )}

        <h2 className="sec-head">In this episode</h2>
        <ul className="pod-notes">
          {episode.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>

        <div className="au-sum-card learn-try">
          <p className="au-detail-k">Take this with you</p>
          <p>{episode.question}</p>
        </div>
        <p className="au-small learn-more">
          Want to go further? Try one of the <Link href="/tools" className="au-text-link">Tools</Link>, or talk it
          through with <Link href="/coaching" className="au-text-link">coaching</Link>.
        </p>
      </article>
    </>
  );
}
