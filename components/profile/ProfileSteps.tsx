// The compact progress path on My profile: Audit completed → Plan created →
// Action underway → Review next. Each step shows only what has really
// happened; a step is never marked done because something else exists.
export type Step = {
  label: string;
  state: "done" | "current" | "todo";
  // Overrides the default Done / Next / Not yet tag.
  stateLabel?: string;
  detail: string;
};

const STATE_LABEL: Record<Step["state"], string> = { done: "Done", current: "Next", todo: "Not yet" };

export function ProfileSteps({ steps }: { steps: Step[] }) {
  return (
    <ol className="psteps">
      {steps.map((s) => (
        <li key={s.label} className={s.state}>
          <span className="psteps-dot" aria-hidden="true">{s.state === "done" ? "✓" : ""}</span>
          <div>
            <p>
              <b>{s.label}</b>
              <span className="psteps-state">{s.stateLabel ?? STATE_LABEL[s.state]}</span>
            </p>
            <em>{s.detail}</em>
          </div>
        </li>
      ))}
    </ol>
  );
}
