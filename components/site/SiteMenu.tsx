"use client";

import { useEffect, useId, useRef, useState } from "react";

// The small-screen menu on public pages (Duane's brief, 11 Nov 2026): a real
// button that says what it does ("Open menu" / "Close menu"), announces
// whether the menu is open, and works with Enter, Space and Escape. Closes
// once a link is chosen, on Escape (focus goes back to the button) and on a
// click elsewhere.
export function SiteMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={wrap} className="site-menu">
      <button
        ref={button}
        type="button"
        className="site-menu-btn"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <nav id={id} aria-label="Main" hidden={!open} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
        {children}
      </nav>
    </div>
  );
}
