"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The thin bar guests get instead of the app's menu. Once they have results,
// it keeps offering to save them on every page until they do; on the two
// pages with a save form it jumps to that form.
export function GuestBar({ hasResults }: { hasResults: boolean }) {
  const pathname = usePathname();
  if (!hasResults) {
    return (
      <div className="guest-bar">
        <span>Using Aligned as a guest</span>
        <Link href="/login" className="guest-bar-link">Already have an account? Sign in</Link>
      </div>
    );
  }
  const here = pathname === "/audit/results" || pathname === "/clear/set";
  return (
    <div className="guest-bar is-unsaved">
      <span className="guest-bar-msg">
        <b>Your results aren&rsquo;t saved yet.</b> For now they&rsquo;re only on this device.
      </span>
      <span className="guest-bar-acts">
        <Link href="/login" className="guest-bar-link">Sign in</Link>
        <a href={here ? "#save" : "/audit/results#save"} className="guest-bar-save">Save your results</a>
      </span>
    </div>
  );
}
