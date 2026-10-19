import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/ui/Logo";
import { AlignmentPreview } from "@/components/alignment/AlignmentPreview";

export const metadata: Metadata = { title: "Daily alignment · Design preview", robots: { index: false, follow: false } };

export default function AlignmentPreviewPage() {
  if (process.env.ALIGNED_ALIGNMENT_PREVIEW !== "1" || process.env.NODE_ENV === "production") notFound();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Logo subtitle="Protocol" />
        <nav className="sb-nav" aria-label="Preview navigation">
          <p className="nav-group-label">You</p>
          <Link className="ni" href="/"><span aria-hidden="true">▦</span> My profile</Link>
          <a className="ni active" href="#alignment-preview" aria-current="page"><span aria-hidden="true">☼</span> Daily alignment</a>
          <Link className="ni" href="/audit"><span aria-hidden="true">◎</span> The Aligned Audit</Link>
          <Link className="ni" href="/clear"><span aria-hidden="true">◈</span> My plan</Link>
          <Link className="ni" href="/summary"><span aria-hidden="true">◑</span> My journey</Link>
          <div className="sb-q"><div className="sb-qm">&ldquo;</div><div className="sb-qt">Alignment is the foundation. Action is the transformation.</div></div>
          <p className="alignment-small" style={{ padding: "0 1.5rem" }}>Fictional member · design preview</p>
        </nav>
      </aside>
      <div className="main" id="alignment-preview"><AlignmentPreview /></div>
    </div>
  );
}
