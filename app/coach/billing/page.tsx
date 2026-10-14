import Link from "next/link";
import { canBill, getInvoiceTracker } from "@/lib/actions/billing";
import { requireAdmin } from "@/lib/actions/admin";
import { formatPence } from "@/lib/money";
import { trackerStatus, TRACKER_LABEL, todayUk, type TrackerStatus } from "@/lib/billing-status";
import { formatDate } from "@/lib/audit-schedule";

const FILTERS: ["all" | TrackerStatus, string][] = [
  ["all", "All"],
  ["unpaid", "Unpaid"],
  ["part_paid", "Part paid"],
  ["overdue", "Overdue"],
  ["paid", "Paid"],
  ["draft", "Drafts"],
  ["void", "Void"],
];

// Every invoice in one list, filtered by where the money is.
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  if (!(await canBill())) {
    return (
      <div className="page admin-page">
        <div className="eyebrow"><span className="eydot" /> Billing</div>
        <h1>Billing isn&rsquo;t switched on for you</h1>
        <p className="lead">
          Billing needs database update 0014, and your account given billing access (the one line in
          <code> supabase/test-setup/billing-access.sql</code>, with your own email).
        </p>
      </div>
    );
  }
  const { status = "all" } = await searchParams;
  const rows = (await getInvoiceTracker()) ?? [];
  const today = todayUk();
  const withStatus = rows.map((r) => ({ ...r, st: trackerStatus(r, today) }));
  const count = (f: string) => (f === "all" ? withStatus.length : withStatus.filter((r) => r.st === f).length);
  const shown = status === "all" ? withStatus : withStatus.filter((r) => r.st === status);
  const live = withStatus.filter((r) => r.status === "issued");
  const owed = live.reduce((t, r) => t + Math.max(r.balance_pence, 0), 0);
  const overdue = live.filter((r) => r.st === "overdue").reduce((t, r) => t + r.balance_pence, 0);
  const notices = withStatus.reduce((t, r) => t + r.notices, 0);

  return (
    <div className="page admin-page">
      <div className="eyebrow"><span className="eydot" /> Billing</div>
      <h1>Invoices</h1>
      <p className="lead">
        Aligned Media · not VAT registered · GBP. Payments count only once recorded from the bank, or confirmed by Stripe.{" "}
        <Link href="/coach/billing/settings">Billing settings</Link>
      </p>

      <div className="admin-stats">
        <Link href="/coach/billing?status=unpaid"><b>{formatPence(owed)}</b><span>Owed</span><em>across {live.filter((r) => r.balance_pence > 0).length} invoices</em></Link>
        <Link href="/coach/billing?status=overdue"><b>{formatPence(overdue)}</b><span>Overdue</span><em>{count("overdue")} invoices</em></Link>
        <Link href="/coach/billing?status=draft"><b>{count("draft")}</b><span>Drafts</span><em>not issued yet</em></Link>
        <div><b>{notices}</b><span>“I’ve paid” to check</span><em>from members</em></div>
      </div>

      <nav className="admin-tabs" aria-label="Filter invoices">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={k === "all" ? "/coach/billing" : `/coach/billing?status=${k}`} aria-current={status === k ? "page" : undefined}>
            {label} {count(k)}
          </Link>
        ))}
      </nav>

      {shown.length ? (
        <div className="admin-table admin-generic" style={{ ["--cols" as string]: 7 }} role="table" aria-label="Invoices">
          <div className="admin-row head" role="row">
            <span role="columnheader">Invoice</span>
            <span role="columnheader">Client</span>
            <span role="columnheader">Issued</span>
            <span role="columnheader">Due</span>
            <span role="columnheader">Total</span>
            <span role="columnheader">Still owed</span>
            <span role="columnheader">Status</span>
          </div>
          {shown.map((r) => (
            <Link key={r.id} href={`/coach/clients/${r.client_id}?tab=billing`} className="admin-row" role="row">
              <span role="cell"><b>{r.number ?? "Draft"}</b></span>
              <span role="cell">{r.client_name ?? "—"}</span>
              <span role="cell">{r.issue_date ? formatDate(r.issue_date) : "—"}</span>
              <span role="cell">{r.due_date ? formatDate(r.due_date) : "—"}</span>
              <span role="cell">{formatPence(r.total_pence)}</span>
              <span role="cell">{r.status === "issued" ? formatPence(Math.max(r.balance_pence, 0)) : "—"}</span>
              <span role="cell">
                <span className={`cs-state bl-${r.st}`}>{TRACKER_LABEL[r.st]}</span>
                {r.notices ? <span className="cs-state bl-overdue">Says paid</span> : null}
                {r.pdf_status === "failed" ? <span className="cs-state">PDF failed</span> : null}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty"><span className="empty-icon" aria-hidden="true">◇</span>No invoices here.</div>
      )}
      <p className="cp-sub" style={{ marginTop: ".75rem" }}>To start an invoice, open the client and go to Payments and invoices.</p>
    </div>
  );
}
