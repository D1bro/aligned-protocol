import Link from "next/link";
import { notFound } from "next/navigation";
import { findLesson, clipFor } from "@/lib/learn-content";
import { getLessonProgress } from "@/lib/actions/learn";
import { GuideVideo } from "@/components/audit/GuideVideo";
import { LessonForm } from "@/components/learn/LessonForm";

export default async function LessonPage({ params }: { params: Promise<{ path: string; lesson: string }> }) {
  const { path: pathSlug, lesson: lessonSlug } = await params;
  const found = findLesson(pathSlug, lessonSlug);
  if (!found) notFound();
  const { path, lesson, index, next } = found;
  const mine = (await getLessonProgress()).find((p) => p.lesson_slug === lesson.slug) ?? null;

  return (
    <>
      <div className="topbar">
        <Link href="/learn" className="tb-back">← Academy</Link>
        <span className="tb-label">{path.title} · {index + 1} of {path.lessons.length}</span>
      </div>
      <article className="page au-page learn-lesson">
        <div className="eyebrow"><span className="eydot" /> Lesson {index + 1} · {lesson.minutes} min</div>
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
          completed={!!mine?.completed_at}
          nextHref={next ? `/learn/${path.slug}/${next.slug}` : "/learn"}
          nextLabel={next ? `Next: ${next.title} →` : "Back to the Academy"}
        />
      </article>
    </>
  );
}
