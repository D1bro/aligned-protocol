import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";

// Public header: How it works · About Duane · Explore · Sign in, and the
// audit as the main action. On small screens the links fold into a menu
// (details/summary: works without JavaScript and from the keyboard).
export function SiteHeader({ cta }: { cta: { href: string; label: string } }) {
  const links = (
    <>
      <a href="/#how">How it works</a>
      <a href="/#about">About Duane</a>
      <a href="/#explore">Explore</a>
      <Link href="/login">Sign in</Link>
    </>
  );
  return (
    <header className="site-head">
      <div className="site-head-in">
        <Link href="/" className="site-brand" aria-label="Aligned, home">
          <BrandMark width={28} />
          <span>ALIGNED</span>
        </Link>
        <nav className="site-nav" aria-label="Main">{links}</nav>
        <div className="site-head-actions">
          <Link href={cta.href} className="btn btn-p site-cta">{cta.label}</Link>
          <details className="site-menu">
            <summary aria-label="Menu">
              <span aria-hidden="true">☰</span>
            </summary>
            <nav aria-label="Main (mobile)">{links}</nav>
          </details>
        </div>
      </div>
    </header>
  );
}
