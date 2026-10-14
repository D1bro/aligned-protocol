import type { MyBilling } from "@/lib/actions/billing";
import { formatPence } from "@/lib/money";
import { formatDate } from "@/lib/audit-schedule";
import { trackerStatus, TRACKER_LABEL, todayUk } from "@/lib/billing-status";
import { InvoicePayActions } from "./InvoicePayActions";

// The member's invoices and paid sessions. Only issued invoices appear;
// amounts come from the database's own sums.
export function MemberInvoices({ data, justPaid }: { data: MyBilling; justPaid: boolean }) {
  if (!data.available || (!data.invoices.length && !data.credits.balance)) return null;
  const today = todayUk();
  return (
    <section className="mc" aria-labelledby="mi-h">
      <h2 id="mi-h" className="mc-title">Invoices and sessions</h2>
      {justPaid ? (
        <p className="bl-ok" role="status">
          Thank you. Your card payment is being confirmed — it shows here once the payment provider confirms it.
        </p>
      ) : null}
      {data.credits.balance || data.credits.reserved ? (
        <p className="admin-card-sub">
          Paid sessions: <b>{data.credits.available}</b> available to book
          {data.credits.reserved ? `, ${data.credits.reserved} set aside for sessions already booked` : ""}.
        </p>
      ) : null}
      <ul className="cs-list">
        {data.invoices.map((inv) => {
          const st = trackerStatus(inv, today);
          const pi = inv.payment_instructions;
          return (
            <li key={inv.id} className="cs-row">
              <div className="cs-row-head">
                <div>
                  <b>{inv.number}</b>
                  <span className={`cs-state bl-${st}`}>{TRACKER_LABEL[st]}</span>
                  <span className="cs-meta">Issued {formatDate(inv.issue_date!)}{inv.status === "issued" ? ` · due ${formatDate(inv.due_date!)}` : ""}</span>
                </div>
                <b>{formatPence(inv.total_pence)}</b>
              </div>
              {inv.status === "void" ? (
                <p className="cs-meta">This invoice was cancelled{inv.void_reason ? `: ${inv.void_reason}` : ""}. Nothing is owed on it.</p>
              ) : (
                <p className="cs-meta">
                  Paid {formatPence(inv.paid_pence)}
                  {inv.credited_pence ? ` · Credited ${formatPence(inv.credited_pence)}` : ""}
                  {inv.balance_pence ? ` · Still to pay ${formatPence(inv.balance_pence)}` : " · Nothing left to pay"}
                  {inv.credits_purchased ? ` · ${inv.credits_purchased} session${inv.credits_purchased === 1 ? "" : "s"}` : ""}
                </p>
              )}
              {inv.status === "issued" && inv.balance_pence > 0 && pi ? (
                <p className="cs-meta">
                  Bank transfer: {pi.account_name} · sort code {pi.sort_code} · account {pi.account_number} · reference <b>{inv.number}</b>
                </p>
              ) : null}
              <div className="bl-row-actions">
                {inv.pdf_status === "ready" ? (
                  <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="au-text-link">Download PDF</a>
                ) : null}
                {inv.status === "issued" && inv.balance_pence > 0 ? (
                  <InvoicePayActions invoiceId={inv.id} card={data.cardPayments} noticeSent={inv.noticeSent} />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
