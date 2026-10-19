"use client";

import { useState } from "react";
import Link from "next/link";
import { dismissDetailsPrompt } from "@/lib/actions/details";

// A gentle, optional invitation after setting up: never blocks the next step.
export function DetailsPrompt() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <section className="profile-card details-prompt" aria-labelledby="details-prompt-h">
      <h2 id="details-prompt-h">Add your details when you&rsquo;re ready.</h2>
      <p>Keep your contact information and location up to date.</p>
      <div className="details-prompt-actions">
        <Link href="/details" className="btn btn-o bl-btn">Add my details</Link>
        <button
          type="button"
          className="au-text-link as-btn"
          onClick={() => {
            setHidden(true);
            void dismissDetailsPrompt();
          }}
        >
          Later
        </button>
      </div>
    </section>
  );
}
