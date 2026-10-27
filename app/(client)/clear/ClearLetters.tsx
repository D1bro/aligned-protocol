"use client";

import { useState } from "react";

// Their answers to the five guided steps: tap a step to read what they wrote.
export function ClearLetters({ items }: { items: { letter: string; name: string; text: string }[] }) {
  const [open, setOpen] = useState(0);
  const item = items[open];
  return (
    <div className="pl-letters">
      <div className="pl-letter-row" role="tablist" aria-label="Your answers">
        {items.map((it, i) => (
          <button
            key={it.letter}
            type="button"
            role="tab"
            id={`clear-tab-${i}`}
            aria-selected={open === i}
            aria-controls="clear-panel"
            onClick={() => setOpen(i)}
          >
            {it.letter}
            <span>{it.name}</span>
          </button>
        ))}
      </div>
      <div className="pl-letter-panel" role="tabpanel" id="clear-panel" aria-labelledby={`clear-tab-${open}`}>
        <h3>{item.name}</h3>
        <p>{item.text || "—"}</p>
      </div>
    </div>
  );
}
