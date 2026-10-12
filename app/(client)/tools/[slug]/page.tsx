import Link from "next/link";
import { notFound } from "next/navigation";
import { TOOLS } from "@/lib/learn-content";
import { getToolEntries } from "@/lib/actions/learn";
import { ToolForm } from "@/components/learn/ToolForm";

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = TOOLS.find((t) => t.slug === slug);
  if (!tool) notFound();
  const entry = (await getToolEntries()).find((e) => e.tool_slug === tool.slug);

  return (
    <>
      <div className="topbar">
        <Link href="/tools" className="tb-back">← Tools</Link>
        <span className="tb-label">{tool.title}</span>
      </div>
      <div className="page au-page learn-lesson">
        <div className="eyebrow"><span className="eydot" /> Tool</div>
        <h1 className="au-latest-h">{tool.title}</h1>
        <p className="lead">{tool.purpose}</p>
        <ToolForm toolSlug={tool.slug} prompts={tool.prompts} initial={entry?.answers ?? {}} />
      </div>
    </>
  );
}
