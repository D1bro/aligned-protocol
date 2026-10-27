import Link from "next/link";
import { notFound } from "next/navigation";
import { findLesson, clipFor, TOOLS } from "@/lib/learn-content";
import { getLessonProgress } from "@/lib/actions/learn";
import { getMainGoal } from "@/lib/actions/goals";
import { getCurrentProfile } from "@/lib/session";
import { GuideVideo } from "@/components/audit/GuideVideo";
import { LessonForm } from "@/components/learn/LessonForm";

export default async function LessonPage({ params }: { params: Promise<{ path: string; lesson: string }> }) {
  const { path: pathSlug, lesson: lessonSlug } = await params;
  const found = findLesson(pathSlug, lessonSlug);
  if (!found) notFound();
  const { path, lesson, index, next } = found;
  const [progress, main, profile] = await Promise.all([getLessonProgress(), getMainGoal(), getCurrentProfile()]);
  const mine = progress.find((p) => p.lesson_slug === lesson.slug) ?? null;
  const tool = lesson.tool ? TOOLS.find((t) => t.slug === lesson.tool) : null;
  const planSet = !!main && !!main.goal.frequency?.trim() && !!main.goal.success_criteria?.trim();

  return (
    <>
      <div className="topbar">
        <Link href="/learn" className="tb-back">← Academy</Link>
        <span className="tb-label">{path.title} · {index + 1} of {path.lessons.length}</span>
      </div>
      <article className="page au-page learn-lesson">
        <div className="eyebrow"><span className="eydot" /> Lesson {index + 1} · about {lesson.minutes} min</div>
        <h1 className="au-latest-h">{lesson.title}</h1>
        {lesson.draft ? <p className="draft-tag">Draft</p> : null}
        <p className="lead">{lesson.summary}</p>

        <GuideVideo clip={clipFor(lesson.slug, lesson.title, lesson.video)} />

        <div className="learn-body">
          {lesson.body.map((para, i) => <p key={i}>{para}</p>)}
        </div>

        <div className="au-sum-card learn-try">
          <p className="au-detail-k">Try this</p>
          <p>{lesson.action}</p>
        </div>

        <LessonForm
          lessonSlug={lesson.slug}
          question={lesson.reflection}
          initialReflection={mine?.reflection ?? ""}
          initialPrivate={mine?.private ?? false}
          hasCoach={!!profile?.coach_id}
          completed={!!mine?.completed_at}
          nextHref={next ? `/learn/${path.slug}/${next.slug}` : "/learn"}
          nextLabel={next ? `Next: ${next.title} →` : "Back to the Academy"}
        />

        <aside className="learn-plan" aria-label="Your plan">
          <p className="au-detail-k">Bring it into your plan</p>
          {planSet && main ? (
            <p>
              You already have a plan{main.area ? ` for ${main.area.name}` : ""}. Check it against this lesson and
              refine it if something has changed. Your lesson answers stay here; they don&rsquo;t change your goal.{" "}
              <Link href="/clear" className="au-text-link">Open my plan</Link>
            </p>
          ) : main ? (
            <p>
              Your plan is started. Take what you&rsquo;ve noticed into it.{" "}
              <Link href="/clear" className="au-text-link">Continue my plan</Link>
            </p>
          ) : (
            <p>
              When you&rsquo;re ready, Build your plan turns this into one clear action.{" "}
              <Link href="/clear" className="au-text-link">Go to My plan</Link>
            </p>
          )}
          {tool || lesson.guide ? (
            <p className="learn-plan-more">
              {lesson.guide ? (
                <>Optional: <Link href="/learn/ten-areas" className="au-text-link">Understanding your ten areas</Link>. </>
              ) : null}
              {tool ? (
                <>Go further with the <Link href={`/tools/${tool.slug}`} className="au-text-link">{tool.title}</Link> tool.</>
              ) : null}
            </p>
          ) : null}
        </aside>
      </article>
    </>
  );
}
