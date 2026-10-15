// What an invoice's state means for the tracker. The money figures come from
// the database (invoice_position); this only names the situation.
//   paid      = nothing left to pay (after payments and credit notes)
//   part_paid = something paid, something still owed
//   overdue   = still owed and past its due date (UK date)
//   unpaid    = issued, nothing paid, not yet due

export type TrackerStatus = "draft" | "void" | "paid" | "part_paid" | "overdue" | "unpaid";

export const TRACKER_LABEL: Record<TrackerStatus, string> = {
  draft: "Draft",
  void: "Void",
  paid: "Paid",
  part_paid: "Part paid",
  overdue: "Overdue",
  unpaid: "Unpaid",
};

export function trackerStatus(
  inv: { status: string; due_date: string | null; paid_pence: number; balance_pence: number },
  todayUk: string
): TrackerStatus {
  if (inv.status === "draft") return "draft";
  if (inv.status === "void") return "void";
  if (inv.balance_pence <= 0) return "paid";
  if (inv.due_date && inv.due_date < todayUk) return "overdue";
  if (inv.paid_pence > 0) return "part_paid";
  return "unpaid";
}

// Today's date in the UK as YYYY-MM-DD.
export function todayUk(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// Totals of a draft from its lines, the same sum the database makes at issue.
export function draftTotals(items: { quantity: number; unit_pence: number }[], discountPence: number) {
  const subtotal = items.reduce((t, i) => t + i.quantity * i.unit_pence, 0);
  return { subtotal, total: subtotal - discountPence };
}

// A possible double entry of the same bank transfer: same client, same
// amount, within a few days, and the same reference if both have one.
export function looksLikeDuplicate(
  a: { amount_pence: number; received_on: string; reference: string | null },
  b: { amount_pence: number; received_on: string; reference: string | null }
): boolean {
  if (a.amount_pence !== b.amount_pence) return false;
  const days = Math.abs(Date.parse(a.received_on) - Date.parse(b.received_on)) / 86_400_000;
  if (days > 3) return false;
  const ra = a.reference?.trim().toLowerCase();
  const rb = b.reference?.trim().toLowerCase();
  return !ra || !rb || ra === rb;
}

// What's still needed before an invoice can be issued. Never filled in for
// you: legal and bank details only ever come from Billing settings.
type SettingsLike = {
  legal_name: string | null;
  address: string | null;
  contact_email: string | null;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
};
export function settingsGaps(s: SettingsLike | null): string[] {
  if (!s) return ["Billing settings"];
  const gaps: string[] = [];
  if (!s.legal_name?.trim()) gaps.push("Legal name");
  if (!s.address?.trim()) gaps.push("Business address");
  if (!s.contact_email?.trim()) gaps.push("Billing contact email");
  if (!s.bank_account_name?.trim() || !s.bank_sort_code?.trim() || !s.bank_account_number?.trim()) gaps.push("Bank details for payment");
  return gaps;
}
