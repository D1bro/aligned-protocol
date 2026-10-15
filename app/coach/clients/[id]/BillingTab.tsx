import Link from "next/link";
import type { ClientBilling } from "@/lib/actions/billing";
import { formatPence } from "@/lib/money";
import { trackerStatus, TRACKER_LABEL, todayUk } from "@/lib/billing-status";
import { formatDate } from "@/lib/audit-schedule";
import { InvoiceEditor } from "./InvoiceEditor";
import { EmailButton } from "./EmailButton";
import type { MessageJob } from "@/lib/actions/messages";
import {
  AdjustCredits,
  AllocatePayment,
  CreditNote,
  CustomerForm,
  NewInvoiceButton,
  NoticeActions,
  PaymentLink,
  RecordPayment,
  RefundPayment,
  RetryPdf,
  ReverseAllocation,
  ReversePayment,
  VoidInvoice,
} from "./BillingActions";

const LEDGER_LABEL: Record<string, string> = { grant: "Paid for", use: "Used", adjust: "Adjusted", credit_note: "Removed by credit note" };

// Payments and invoices for one client: their invoices (drafts editable,
// issued ones frozen), the money received and where it went, and their
// session credits. Coaches without billing access see the credits only.
export function BillingTab({ b, clientId, jobs, firstName }: { b: ClientBilling; clientId: string; jobs: MessageJob[]; firstName: string }) {
  if (!b.available) {
    return <p className="plan-note">Invoicing needs database update 0014. Run it, then reload.</p>;
  }

  const credits = (
    <section className="admin-card" aria-label="Session credits">
      <div className="bl-head">
        <h2>Session credits</h2>
        {b.canBill ? <AdjustCredits clientId={clientId} /> : null}
      </div>
      <div className="bl-credit-facts">
        <div><b>{b.credits.available}</b><span>Available to book</span></div>
        <div><b>{b.credits.reserved}</b><span>Held for booked sessions</span></div>
        <div><b>{b.credits.balance}</b><span>Unused in total</span></div>
      </div>
      {b.ledger.length ? (
        <ul className="bl-ledger">
          {b.ledger.map((l) => (
            <li key={l.id}>
              <span className={l.quantity > 0 ? "cp-up" : "cp-down"}>{l.quantity > 0 ? `+${l.quantity}` : l.quantity}</span>
              <span>{LEDGER_LABEL[l.kind] ?? l.kind}{l.reason ? ` · ${l.reason}` : ""}</span>
              <span className="cs-meta">{formatDate(l.created_at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cp-sub">No session credits yet. They&rsquo;re added when an invoice that includes sessions is paid in full.</p>
      )}
    </section>
  );

  if (!b.canBill) {
    return (
      <>
        {credits}
        <p className="cp-sub">Invoices and payments are only visible to the billing admin.</p>
      </>
    );
  }

  const today = todayUk();
  const open = b.invoices
    .filter((i) => i.status === "issued" && i.balance_pence > 0)
    .map((i) => ({ id: i.id, number: i.number!, balance: i.balance_pence }));
  const owed = open.reduce((t, i) => t + i.balance, 0);
  const unallocated = b.receipts.reduce((t, r) => t + r.unapplied_pence, 0);
  const gaps = [...b.settingsGaps, ...(b.customer ? [] : ["the client’s billing name (above)"])];
  const newNotices = b.notices.filter((n) => n.status === "new");
  const invNumber = new Map(b.invoices.map((i) => [i.id, i.number ?? "draft"]));

  return (
    <section aria-label="Payments and invoices" className="bl-wrap">
      <div className="bl-summary">
        <div><span>Owed</span><b>{formatPence(owed)}</b></div>
        <div><span>Unallocated money</span><b>{formatPence(unallocated)}</b></div>
        <div><span>Sessions available</span><b>{b.credits.available}</b></div>
        <div>
          <span>Bill to</span>
          <b>{b.customer?.name ?? "Not set"}</b>
          <CustomerForm clientId={clientId} customer={b.customer} />
        </div>
      </div>

      {newNotices.map((n) => (
        <p key={n.id} className="bl-warn">
          They say they&rsquo;ve paid {invNumber.get(n.invoice_id)} ({formatDate(n.created_at)}){n.note ? `: “${n.note}”` : "."} Check the bank,
          then record the payment. <NoticeActions noticeId={n.id} clientId={clientId} />
        </p>
      ))}

      <div className="bl-head">
        <h2 className="sec-head">Invoices</h2>
        <NewInvoiceButton clientId={clientId} />
      </div>
      {b.invoices.length ? (
        <ul className="cs-list">
          {b.invoices.map((inv) => {
            const st = trackerStatus(inv, today);
            const notes = b.creditNotes.filter((c) => c.invoice_id === inv.id);
            const creditsLeft = inv.credits_purchased - notes.reduce((t, c) => t + c.credits_removed, 0);
            return (
              <li key={inv.id} className="cs-row">
                <div className="cs-row-head">
                  <div>
                    <b>{inv.number ?? "Draft invoice"}</b>
                    <span className={`cs-state bl-${st}`}>{TRACKER_LABEL[st]}</span>
                    {inv.status !== "draft" ? <span className="cs-meta">Issued {formatDate(inv.issue_date!)} · due {formatDate(inv.due_date!)}</span> : null}
                  </div>
                  <b>{formatPence(inv.total_pence)}</b>
                </div>
                {inv.status === "draft" ? (
                  <InvoiceEditor invoice={inv} clientId={clientId} gaps={gaps} />
                ) : (
                  <>
                    <ul className="bl-items">
                      {inv.items.map((it) => (
                        <li key={it.id}>
                          <span>{it.description}{it.quantity > 1 ? ` × ${it.quantity}` : ""}</span>
                          <span>{formatPence(it.quantity * it.unit_pence)}</span>
                        </li>
                      ))}
                      {inv.discount_pence ? <li><span>Discount</span><span>−{formatPence(inv.discount_pence)}</span></li> : null}
                    </ul>
                    {inv.status === "void" ? (
                      <p className="cs-meta">Void, nothing owed{inv.void_reason ? ` · ${inv.void_reason}` : ""}</p>
                    ) : (
                      <p className="cs-meta">
                        Paid {formatPence(inv.paid_pence)}
                        {inv.credited_pence ? ` · Credited ${formatPence(inv.credited_pence)}` : ""} · Still owed {formatPence(Math.max(inv.balance_pence, 0))}
                        {inv.credits_purchased ? ` · Includes ${inv.credits_purchased} session${inv.credits_purchased === 1 ? "" : "s"}` : ""}
                      </p>
                    )}
                    {notes.map((c) => (
                      <p key={c.id} className="cs-meta">
                        Credit note {c.number} · {formatPence(c.amount_pence)} · {c.reason}
                        {c.credits_removed ? ` · ${c.credits_removed} session credit${c.credits_removed === 1 ? "" : "s"} removed` : ""}
                      </p>
                    ))}
                    <div className="bl-row-actions">
                      {inv.pdf_status === "ready" ? (
                        <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="au-text-link">PDF</a>
                      ) : inv.pdf_status === "failed" || inv.pdf_status === "pending" ? (
                        <>
                          <span className="clear-err">PDF {inv.pdf_status === "failed" ? "failed" : "not made yet"}</span>
                          <RetryPdf invoiceId={inv.id} />
                        </>
                      ) : null}
                      {inv.status === "issued" ? (
                        <EmailButton kind="invoice_issued" refId={inv.id} label={`Email to ${firstName}`} last={jobs.find((j) => j.dedupe_key.startsWith(`invoice:${inv.id}`)) ?? null} />
                      ) : null}
                      {inv.status === "issued" && inv.balance_pence > 0 ? (
                        <>
                          {b.stripe.ready ? <PaymentLink invoiceId={inv.id} clientId={clientId} url={inv.payment_link_url} /> : null}
                          <CreditNote invoiceId={inv.id} clientId={clientId} maxPence={inv.balance_pence} creditsLeft={creditsLeft} />
                          {inv.paid_pence === 0 ? <VoidInvoice invoiceId={inv.id} clientId={clientId} /> : null}
                        </>
                      ) : null}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="cp-sub">No invoices yet.</p>
      )}
      {!b.stripe.ready ? <p className="cs-meta">{b.stripe.reason} Bank transfer works without it.</p> : null}

      <div className="bl-head">
        <h2 className="sec-head">Money received</h2>
        <RecordPayment clientId={clientId} openInvoices={open} />
      </div>
      {b.receipts.length ? (
        <ul className="cs-list">
          {b.receipts.map((r) => {
            const active = r.allocations.filter((a) => !a.reversed_at);
            const refunds = b.refunds.filter((f) => f.receipt_id === r.id);
            return (
              <li key={r.id} className={`cs-row${r.status === "reversed" ? " bl-reversed" : ""}`}>
                <div className="cs-row-head">
                  <div>
                    <b>{formatPence(r.amount_pence)}</b>
                    <span className="cs-state">{r.source === "bank_transfer" ? "Bank transfer" : "Card"}</span>
                    {r.status === "reversed" ? <span className="cs-state">Entered in error</span> : null}
                    <span className="cs-meta">Arrived {formatDate(r.received_on)}{r.reference ? ` · ref ${r.reference}` : ""}</span>
                  </div>
                  {r.status === "confirmed" && r.unapplied_pence > 0 ? <span className="bl-unapplied">{formatPence(r.unapplied_pence)} unallocated</span> : null}
                </div>
                {r.note ? <p className="cs-meta">{r.note}</p> : null}
                {r.reverse_reason ? <p className="cs-meta">Reason: {r.reverse_reason}</p> : null}
                {r.allocations.length ? (
                  <ul className="bl-items">
                    {r.allocations.map((a) => (
                      <li key={a.id} className={a.reversed_at ? "bl-reversed" : undefined}>
                        <span>
                          → {invNumber.get(a.invoice_id)}
                          {a.reversed_at ? ` · undone: ${a.reverse_reason}` : ""}
                        </span>
                        <span>
                          {formatPence(a.amount_pence)} {!a.reversed_at && r.status === "confirmed" ? <ReverseAllocation allocationId={a.id} clientId={clientId} /> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {refunds.map((f) => (
                  <p key={f.id} className="cs-meta">Refunded {formatPence(f.amount_pence)} on {formatDate(f.refunded_on)} · {f.reason}</p>
                ))}
                {r.status === "confirmed" ? (
                  <div className="bl-row-actions">
                    {r.unapplied_pence > 0 ? <AllocatePayment receiptId={r.id} clientId={clientId} unapplied={r.unapplied_pence} openInvoices={open} /> : null}
                    {r.unapplied_pence > 0 ? <RefundPayment receiptId={r.id} clientId={clientId} unapplied={r.unapplied_pence} /> : null}
                    {!active.length && !refunds.length ? <ReversePayment receiptId={r.id} clientId={clientId} /> : null}
                    <EmailButton kind="payment_received" refId={r.id} label="Email a receipt" last={jobs.find((j) => j.dedupe_key.startsWith(`receipt:${r.id}`)) ?? null} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="cp-sub">No payments recorded.</p>
      )}

      {credits}
      <p className="cs-meta">
        <Link href="/coach/billing">All invoices</Link> · <Link href="/coach/billing/settings">Billing settings</Link>
      </p>
    </section>
  );
}
