import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { SiteMenu } from "./SiteMenu";

// Public header: How it works · About Duane · Explore · Sign in, and the
// audit as the main action. On small screens the links fold into a menu
// (details/summary: works without JavaScript and from the keyboard).
export function SiteHeader({ cta }: { cta: { href: string; label: string } }) {
  const links = (
    <>
      <Link href="/#how">How it works</Link>
      <Link href="/#about">About Duane</Link>
      <Link href="/#explore">Explore</Link>
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
          <SiteMenu>{links}</SiteMenu>
        </div>
      </div>
    </header>
  );
}
