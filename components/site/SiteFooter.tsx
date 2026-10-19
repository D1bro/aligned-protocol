import Link from "next/link";
import { LEGAL, SITE } from "@/lib/site-copy";

const isLive = process.env.VERCEL_ENV === "production";

// The public footer: one brand, one contact address, and the legal pages
// once they're approved (previews show them while they're drafts).
export function SiteFooter() {
  const showLegal = LEGAL.approved || !isLive;
  return (
    <footer className="site-foot">
      <div className="home-in site-foot-in">
        <span>Alignment is the foundation. Action is the transformation.</span>
        <span>
          © {new Date().getFullYear()} {SITE.owner} · <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> · <Link href="/login">Sign in</Link>
          {showLegal ? <> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></> : null}
        </span>
      </div>
    </footer>
  );
}
