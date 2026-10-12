// How often people are invited to retake the audit. Change this one value
// to adjust the rhythm everywhere (audit page, dashboard, CLEAR).
// Quarterly: long enough for a real change to show in a score, short
// enough to keep momentum; CLEAR covers the weeks in between.
export const AUDIT_EVERY_DAYS = 91;
export const AUDIT_EVERY_LABEL = "every 3 months";

export function nextAuditDue(completedAt: string): Date {
  const d = new Date(completedAt);
  d.setDate(d.getDate() + AUDIT_EVERY_DAYS);
  return d;
}

export function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
