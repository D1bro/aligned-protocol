import { notFound } from "next/navigation";
import { LEGAL } from "@/lib/site-copy";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

const isLive = process.env.VERCEL_ENV === "production";

// Shared layout for /privacy and /terms. Until LEGAL.approved, the live site
// doesn't serve them at all; previews show them marked as drafts.
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  if (!LEGAL.approved && isLive) notFound();
  return (
    <div className="site">
      <SiteHeader cta={{ href: "/audit", label: "Take the free audit" }} />
      <main className="home-sec legal-page">
        <div className="home-in legal-in">
          {LEGAL.approved ? null : (
            <p className="legal-draft" role="note">
              Draft for review. Items marked <b>[to confirm]</b> need Duane&rsquo;s details, and the whole page should be
              checked (ideally by a solicitor) before it goes live.
            </p>
          )}
          <h1>{title}</h1>
          <p className="legal-updated">Last updated: {LEGAL.updated}</p>
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
