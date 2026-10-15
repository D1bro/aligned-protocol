"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteDraftInvoice, issueInvoice, saveDraftInvoice, type Invoice } from "@/lib/actions/billing";
import { formatPence, parsePounds, penceToInput } from "@/lib/money";
import { draftTotals } from "@/lib/billing-status";

type Line = { description: string; quantity: number; unit: string };

// A draft invoice: lines, discount and the session credits it buys. Nothing
// is numbered or sent until "Issue", which freezes it.
export function InvoiceEditor({ invoice, clientId, gaps }: { invoice: Invoice; clientId: string; gaps: string[] }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(
    invoice.items.length
      ? invoice.items.map((i) => ({ description: i.description, quantity: i.quantity, unit: penceToInput(i.unit_pence) }))
      : [{ description: "", quantity: 1, unit: "" }]
  );
  const [discount, setDiscount] = useState(invoice.discount_pence ? penceToInput(invoice.discount_pence) : "");
  const [credits, setCredits] = useState(String(invoice.credits_purchased));
  const [period, setPeriod] = useState(invoice.service_period ?? "");
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [due, setDue] = useState(invoice.due_date ?? "");
  const [version, setVersion] = useState(invoice.version);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<null | "save" | "issue" | "delete">(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmIssue, setConfirmIssue] = useState(false);

  const parsed = lines.map((l) => ({ quantity: l.quantity || 0, unit_pence: parsePounds(l.unit) ?? 0 }));
  const { subtotal, total } = draftTotals(parsed, parsePounds(discount) ?? 0);
  const edit = (f: () => void) => {
    f();
    setDirty(true);
    setConfirmIssue(false);
  };
  const setLine = (i: number, patch: Partial<Line>) => edit(() => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l))));

  async function save(): Promise<boolean> {
    setPending("save");
    setMsg(null);
    const r = await saveDraftInvoice({
      invoiceId: invoice.id,
      clientId,
      version,
      items: lines,
      discount,
      credits: Number(credits) || 0,
      servicePeriod: period,
      notes,
      dueDate: due,
    });
    setPending(null);
    if (!r.ok) {
      setMsg({ ok: false, text: r.message });
      return false;
    }
    if (r.version) setVersion(r.version);
    setDirty(false);
    setMsg({ ok: true, text: "Draft saved." });
    router.refresh();
    return true;
  }

  async function issue() {
    if (dirty && !(await save())) return;
    setPending("issue");
    setMsg(null);
    const r = await issueInvoice(invoice.id, clientId);
    setPending(null);
    if (!r.ok) {
      setConfirmIssue(false);
      return setMsg({ ok: false, text: r.message });
    }
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Delete this draft? It hasn’t been issued, so nothing is lost from the record.")) return;
    setPending("delete");
    const r = await deleteDraftInvoice(invoice.id, clientId);
    setPending(null);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    router.refresh();
  }

  return (
    <div className="bl-editor">
      <div className="bl-lines" role="table" aria-label="Invoice lines">
        <div className="bl-line head" role="row">
          <span role="columnheader">Description</span>
          <span role="columnheader">Qty</span>
          <span role="columnheader">Unit price</span>
          <span role="columnheader">Amount</span>
          <span />
        </div>
        {lines.map((l, i) => (
          <div className="bl-line" role="row" key={i}>
            <input aria-label={`Line ${i + 1} description`} value={l.description} placeholder="e.g. Focus Series — three coaching sessions" onChange={(e) => setLine(i, { description: e.target.value })} />
            <input aria-label={`Line ${i + 1} quantity`} type="number" min={1} max={1000} value={l.quantity} onChange={(e) => setLine(i, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
            <input aria-label={`Line ${i + 1} unit price`} inputMode="decimal" placeholder="£0.00" value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} className={l.unit && parsePounds(l.unit) === null ? "bl-bad" : undefined} />
            <span className="bl-amt">{formatPence((l.quantity || 0) * (parsePounds(l.unit) ?? 0))}</span>
            <button type="button" className="au-text-link as-btn" aria-label={`Remove line ${i + 1}`} disabled={lines.length === 1} onClick={() => edit(() => setLines(lines.filter((_, j) => j !== i)))}>✕</button>
          </div>
        ))}
        <button type="button" className="au-text-link as-btn" onClick={() => edit(() => setLines([...lines, { description: "", quantity: 1, unit: "" }]))}>+ Add a line</button>
      </div>

      <div className="cs-grid">
        <label><span>Discount (optional)</span><input inputMode="decimal" placeholder="£0.00" value={discount} onChange={(e) => edit(() => setDiscount(e.target.value))} /></label>
        <label><span>Sessions this buys</span><input type="number" min={0} max={100} value={credits} onChange={(e) => edit(() => setCredits(e.target.value))} /></label>
        <label><span>Service period (optional)</span><input value={period} placeholder="e.g. November–December 2026" onChange={(e) => edit(() => setPeriod(e.target.value))} /></label>
        <label><span>Due date (optional)</span><input type="date" value={due} onChange={(e) => edit(() => setDue(e.target.value))} /></label>
        <label className="bl-wide"><span>Note on the invoice (optional)</span><textarea rows={2} value={notes} onChange={(e) => edit(() => setNotes(e.target.value))} /></label>
      </div>
      <p className="cs-meta">
        Sessions are added to their account once the invoice is paid in full. Leave the due date empty to use your payment terms.
      </p>

      <div className="bl-totals">
        <span>Subtotal <b>{formatPence(subtotal)}</b></span>
        {parsePounds(discount) ? <span>Discount <b>−{formatPence(parsePounds(discount) ?? 0)}</b></span> : null}
        <span>Total <b>{formatPence(total)}</b></span>
        <span className="cs-meta">No VAT (not VAT registered)</span>
      </div>

      {gaps.length ? (
        <p className="bl-warn">
          Before this can be issued, add in <a href="/coach/billing/settings">Billing settings</a>: {gaps.join(", ")}.
        </p>
      ) : null}

      {confirmIssue ? (
        <div className="bl-confirm" role="alertdialog" aria-label="Confirm issue">
          <p>
            Issue this invoice for <b>{formatPence(total)}</b>? It gets the next invoice number and can&rsquo;t be edited after —
            only voided or credited. It becomes visible in the client&rsquo;s member area. Nothing is emailed.
          </p>
          <div className="cs-actions">
            <button type="button" className="btn btn-p" disabled={!!pending} onClick={issue}>{pending === "issue" ? "Issuing…" : "Yes, issue it"}</button>
            <button type="button" className="au-text-link as-btn" onClick={() => setConfirmIssue(false)}>Not yet</button>
          </div>
        </div>
      ) : (
        <div className="cs-actions">
          <button type="button" className="btn btn-g" disabled={!!pending || !dirty} onClick={save}>{pending === "save" ? "Saving…" : dirty ? "Save draft" : "Saved"}</button>
          <button type="button" className="btn btn-p" disabled={!!pending || total <= 0 || gaps.length > 0} onClick={() => setConfirmIssue(true)}>Issue…</button>
          <button type="button" className="au-text-link as-btn" disabled={!!pending} onClick={remove}>Delete draft</button>
        </div>
      )}
      {msg ? <p className={msg.ok ? "bl-ok" : "clear-err"} role={msg.ok ? "status" : "alert"}>{msg.text}</p> : null}
    </div>
  );
}
