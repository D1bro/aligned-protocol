import Link from "next/link";
import { ACADEMY_INTRO, PATHS } from "@/lib/learn-content";
import { getLessonProgress } from "@/lib/actions/learn";

// Academy: short guided paths. Each lesson is a short read (or video), one
// private reflection and one thing to try.
export default async function AcademyPage() {
  const progress = await getLessonProgress();
  const done = new Set(progress.filter((p) => p.completed_at).map((p) => p.lesson_slug));

  return (
    <div className="page au-page">
      <div className="eyebrow"><span className="eydot" /> Academy</div>
      <h1 className="au-latest-h">Learn at <em>your own pace.</em></h1>
      <p className="lead">{ACADEMY_INTRO}</p>

      {PATHS.map((path) => {
        const count = path.lessons.filter((l) => done.has(l.slug)).length;
        const next = path.lessons.find((l) => !done.has(l.slug)) ?? null;
        return (
          <section key={path.slug} className="learn-path" aria-labelledby={`path-${path.slug}`}>
            <div className="learn-path-head">
              <div>
                <div className="eyebrow"><span className="eydot" /> Path · {path.lessons.length} lessons</div>
                <h2 id={`path-${path.slug}`}>{path.title}</h2>
                <p>{path.promise}</p>
                <p className="learn-guide-link">
                  New to the ten areas? <Link href="/learn/ten-areas" className="au-text-link">Understanding your ten areas</Link>{" "}
                  <span>· optional guide</span>
                </p>
              </div>
              <Link href={`/learn/${path.slug}/${(next ?? path.lessons[0]).slug}`} className="btn btn-p">
                {count === 0 ? "Start the path →" : next ? "Continue →" : "Review the path"}
              </Link>
            </div>
            <div className="learn-bar" role="img" aria-label={`${count} of ${path.lessons.length} lessons done`}>
              <span style={{ width: `${(count / path.lessons.length) * 100}%` }} />
            </div>
            <ol className="learn-lessons">
              {path.lessons.map((l, i) => {
                const isDone = done.has(l.slug);
                const isNext = next?.slug === l.slug;
                return (
                  <li key={l.slug} className={isDone ? "done" : isNext ? "next" : undefined}>
                    <Link href={`/learn/${path.slug}/${l.slug}`}>
                      <span className="learn-num" aria-hidden="true">{isDone ? "✓" : i + 1}</span>
                      <div>
                        <b>{l.title}</b>
                        <span>{l.summary}</span>
                      </div>
                      <em>{isDone ? "Done" : isNext ? "Up next" : `${l.minutes} min`}</em>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      <p className="au-small learn-more">
        Finishing a lesson means your reflection is saved; it doesn&rsquo;t change your goal. More paths are on the way.
        Meanwhile, the <Link href="/tools" className="au-text-link">Tools</Link> help you put each lesson into practice.
      </p>
    </div>
  );
}
