"use client";

import { useRef } from "react";

// The small-screen menu. Closes once a link is chosen, so jumping to a
// section on the same page doesn't leave it covering the content.
export function SiteMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="site-menu" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) ref.current?.removeAttribute("open"); }}>
      <summary aria-label="Menu">
        <span aria-hidden="true">☰</span>
      </summary>
      <nav aria-label="Main (mobile)">{children}</nav>
    </details>
  );
}
