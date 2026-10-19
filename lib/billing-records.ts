import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

// Money records are kept for the accounts, so anyone with one of these can't
// be removed (the database refuses too: these tables block the delete).
const BILLING_TABLES = ["invoices", "receipts", "credit_notes", "refunds", "entitlement_ledger"] as const;

// Which of these people have any billing record, drafts included.
export async function withBillingRecords(admin: ReturnType<typeof createAdminClient>, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += 90) {
    const part = ids.slice(i, i + 90);
    const results = await Promise.all(BILLING_TABLES.map((t) => admin.from(t).select("client_id").in("client_id", part).limit(1000)));
    for (const [n, r] of results.entries()) {
      if (r.error) throw new Error(`${BILLING_TABLES[n]}: ${r.error.message}`);
      for (const row of r.data ?? []) found.add(row.client_id as string);
    }
  }
  return found;
}
