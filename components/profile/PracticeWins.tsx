// The daily practice's three small wins, and the mark for each.
export const WINS = [
  { key: "arrive", label: "Listen and arrive" },
  { key: "intention", label: "Today’s intention" },
  { key: "reflect", label: "Evening reflection" },
] as const;

export function Mark({ done }: { done: boolean }) {
  return done ? (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="9" fill="currentColor" /><path d="M5 9.2l2.6 2.6L13 6.4" fill="none" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
  );
}
