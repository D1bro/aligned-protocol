import Link from "next/link";
import { notFound } from "next/navigation";
import { MUSINGS, clipFor } from "@/lib/learn-content";
import { GuideVideo } from "@/components/audit/GuideVideo";

export default async function MusingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const musing = MUSINGS.find((m) => m.slug === slug);
  if (!musing) notFound();

  return (
    <>
      <div className="topbar">
        <Link href="/musings" className="tb-back">← Musings</Link>
        <span className="tb-label">Duane&rsquo;s Musings</span>
      </div>
      <article className="page au-page learn-lesson">
        <div className="eyebrow"><span className="eydot" /> Musing</div>
        <h1 className="au-latest-h">{musing.title}</h1>
        {musing.draft ? <p className="draft-tag">Draft</p> : null}
        <p className="lead">{musing.summary}</p>
        <GuideVideo clip={clipFor(musing.slug, musing.title, musing.video)} />
        <div className="learn-body">
          {musing.body.map((para, i) => <p key={i}>{para}</p>)}
        </div>
        <div className="au-sum-card learn-try">
          <p className="au-detail-k">Take this with you</p>
          <p>{musing.question}</p>
        </div>
        <p className="au-small learn-more">
          Want to go further? Try one of the <Link href="/tools" className="au-text-link">Tools</Link>, or talk it
          through with <Link href="/coaching" className="au-text-link">coaching</Link>.
        </p>
      </article>
    </>
  );
}
