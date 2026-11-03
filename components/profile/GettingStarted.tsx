// The way in for new members (brief, 3 Nov 2026): Welcome → Protocol →
// Alignment Map → Suggested goal → First action → My Space. Shown on My Space
// until their plan is set; `at` is the step they're on (0-based).
const STEPS = ["The Aligned Protocol", "Your Alignment Map", "Your goal", "Your first action"];

export function GettingStarted({ at }: { at: number }) {
  return (
    <ol className="ms-steps" aria-label={`Getting started: step ${at + 1} of ${STEPS.length}`}>
      {STEPS.map((s, i) => (
        <li key={s} className={i < at ? "done" : i === at ? "current" : undefined} aria-current={i === at ? "step" : undefined}>
          <span className="ms-steps-dot" aria-hidden="true">{i < at ? "✓" : i + 1}</span>
          {s}
          <span className="sr-only">{i < at ? ": done" : i === at ? ": you are here" : ""}</span>
        </li>
      ))}
    </ol>
  );
}
