"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adjustCredits,
  allocatePayment,
  createDraftInvoice,
  createPaymentLink,
  issueCreditNote,
  makeInvoicePdf,
  markNotice,
  recordBankPayment,
  recordRefund,
  resolveNoShowCredit,
  reverseAllocation,
  reversePayment,
  saveCustomer,
  voidInvoice,
} from "@/lib/actions/billing";
import { draftInvoiceFromPackage } from "@/lib/actions/packages";
import { formatPence, penceToInput } from "@/lib/money";
import { todayUk } from "@/lib/billing-status";

// The small, separate things that can be done with money on a client's
// account. Each opens its own fields, asks for a reason where the record
// matters, and shows the database's answer in plain words.

type Res = { ok: boolean; message?: string };
type Field =
  | { name: string; label: string; kind: "text" | "money" | "date" | "number" | "textarea"; placeholder?: string; initial?: string }
  | { name: string; label: string; kind: "select"; options: [string, string][]; initial?: string };

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ActionForm({
  open: openLabel,
  submit,
  fields,
  run,
  tone = "g",
  warning,
}: {
  open: string;
  submit: string;
  fields: Field[];
  run: (v: Record<string, string>) => Promise<Res>;
  tone?: "p" | "g" | "link";
  warning?: string;
}) {
  const router = useRouter();
  const initial = () => Object.fromEntries(fields.map((f) => [f.name, f.initial ?? (f.kind === "select" ? f.options[0]?.[0] ?? "" : "")]));
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function go() {
    setPending(true);
    setMsg(null);
    const r = await run(values);
    setPending(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message ?? "Couldn’t save — try again." });
    setOpen(false);
    setValues(initial());
    if (r.message) setMsg({ ok: true, text: r.message });
    router.refresh();
  }

  if (!open) {
    return (
      <span className="bl-act">
        <button
          type="button"
          className={tone === "link" ? "au-text-link as-btn" : `btn btn-${tone} bl-btn`}
          onClick={() => {
            // Start from today's figures, not the ones from when the page loaded.
            setValues(initial());
            setOpen(true);
            setMsg(null);
          }}
        >
          {openLabel}
        </button>
        {msg ? <span className={msg.ok ? "bl-ok" : "clear-err"} role="status">{msg.text}</span> : null}
      </span>
    );
  }
  return (
    <div className="bl-form">
      {warning ? <p className="bl-warn">{warning}</p> : null}
      <div className="cs-grid">
        {fields.map((f) => (
          <label key={f.name} className={f.kind === "textarea" ? "bl-wide" : undefined}>
            <span>{f.label}</span>
            {f.kind === "select" ? (
              <select value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
                {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ) : f.kind === "textarea" ? (
              <textarea rows={3} value={values[f.name]} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
            ) : (
              <input
                type={f.kind === "money" ? "text" : f.kind}
                inputMode={f.kind === "money" ? "decimal" : undefined}
                value={values[f.name]}
                placeholder={f.placeholder ?? (f.kind === "money" ? "£0.00" : undefined)}
                onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
              />
            )}
          </label>
        ))}
      </div>
      <div className="cs-actions">
        <button type="button" className="btn btn-p" disabled={pending} onClick={go}>
          {pending ? "Saving…" : submit}
        </button>
        <button type="button" className="au-text-link as-btn" onClick={() => setOpen(false)}>Cancel</button>
        {msg && !msg.ok ? <span className="clear-err" role="alert">{msg.text}</span> : null}
      </div>
    </div>
  );
}

export function CustomerForm({ clientId, customer }: { clientId: string; customer: { name: string; email: string | null; address: string | null } | null }) {
  return (
    <ActionForm
      open={customer ? "Edit billing details" : "Add billing details"}
      submit="Save billing details"
      tone={customer ? "link" : "p"}
      fields={[
        { name: "name", label: "Bill to (name)", kind: "text", initial: customer?.name ?? "" },
        { name: "email", label: "Billing email", kind: "text", initial: customer?.email ?? "" },
        { name: "address", label: "Address (optional)", kind: "textarea", initial: customer?.address ?? "" },
      ]}
      run={(v) => saveCustomer({ clientId, name: v.name, email: v.email, address: v.address })}
    />
  );
}

export function NewInvoiceButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="bl-act">
      <button
        type="button"
        className="btn btn-p"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const r = await createDraftInvoice(clientId);
          setPending(false);
          if (!r.ok) return setErr(r.message);
          router.refresh();
        }}
      >
        {pending ? "Starting…" : "New invoice"}
      </button>
      {err ? <span className="clear-err" role="alert">{err}</span> : null}
    </span>
  );
}

export function RetryPdf({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="bl-act">
      <button
        type="button"
        className="au-text-link as-btn"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setErr(null);
          const r = await makeInvoicePdf(invoiceId);
          setPending(false);
          if (!r.ok) return setErr(r.message);
          router.refresh();
        }}
      >
        {pending ? "Making the PDF…" : "Retry PDF"}
      </button>
      {err ? <span className="clear-err" role="alert">{err}</span> : null}
    </span>
  );
}

export function PaymentLink({ invoiceId, clientId, url }: { invoiceId: string; clientId: string; url: string | null }) {
  const router = useRouter();
  const [link, setLink] = useState(url);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="bl-act">
      <button
        type="button"
        className="au-text-link as-btn"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setMsg(null);
          const r = await createPaymentLink(invoiceId, clientId);
          setPending(false);
          if (!r.ok) return setMsg(r.message);
          setLink(r.url ?? null);
          router.refresh();
        }}
      >
        {pending ? "Creating…" : link ? "New card payment link" : "Card payment link"}
      </button>
      {link ? (
        <button type="button" className="au-text-link as-btn" onClick={() => navigator.clipboard?.writeText(link).then(() => setMsg("Link copied."))}>
          Copy link
        </button>
      ) : null}
      {msg ? <span className="bl-note" role="status">{msg}</span> : null}
    </span>
  );
}

export function VoidInvoice({ invoiceId, clientId }: { invoiceId: string; clientId: string }) {
  return (
    <ActionForm
      open="Void"
      submit="Void this invoice"
      tone="link"
      warning="Voiding keeps the invoice and its number on record, marked void. Use it when nothing has been paid."
      fields={[{ name: "reason", label: "Reason", kind: "text", placeholder: "e.g. issued to the wrong person" }]}
      run={(v) => voidInvoice(invoiceId, clientId, v.reason)}
    />
  );
}

export function CreditNote({ invoiceId, clientId, maxPence, creditsLeft }: { invoiceId: string; clientId: string; maxPence: number; creditsLeft: number }) {
  return (
    <ActionForm
      open="Credit note"
      submit="Issue credit note"
      tone="link"
      warning={`Reduces what’s owed (up to ${formatPence(maxPence)}). It gets its own number and can’t be edited after.`}
      fields={[
        { name: "amount", label: "Amount", kind: "money", initial: penceToInput(maxPence) },
        { name: "reason", label: "Reason", kind: "text" },
        ...(creditsLeft > 0
          ? [{ name: "credits", label: "Session credits to remove", kind: "number" as const, initial: "0" }]
          : []),
      ]}
      run={(v) => issueCreditNote({ invoiceId, clientId, amount: v.amount, reason: v.reason, creditsRemoved: Number(v.credits ?? 0) || 0 })}
    />
  );
}

export function RecordPayment({ clientId, openInvoices }: { clientId: string; openInvoices: { id: string; number: string; balance: number }[] }) {
  const router = useRouter();
  const blank = () => ({ amount: "", receivedOn: todayUk(), reference: "", note: "", allocateTo: openInvoices[0]?.id ?? "", key: newKey() });
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(blank);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dup, setDup] = useState<{ amount_pence: number; received_on: string; reference: string | null } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function go(allowDuplicate: boolean) {
    setPending(true);
    setErr(null);
    const r = await recordBankPayment({
      clientId,
      amount: v.amount,
      receivedOn: v.receivedOn,
      reference: v.reference,
      note: v.note,
      operationKey: v.key,
      allocateTo: v.allocateTo || null,
      allowDuplicate,
    });
    setPending(false);
    if (!r.ok) {
      setErr(r.message);
      setDup("duplicate" in r && r.duplicate ? r.duplicate : null);
      return;
    }
    setDup(null);
    setOpen(false);
    setDone(r.message ?? "Payment recorded.");
    setV(blank());
    router.refresh();
  }

  if (!open) {
    return (
      <span className="bl-act">
        <button type="button" className="btn btn-g bl-btn" onClick={() => { setV(blank()); setOpen(true); setDone(null); }}>Record a bank payment</button>
        {done ? <span className="bl-ok" role="status">{done}</span> : null}
      </span>
    );
  }
  return (
    <div className="bl-form">
      <p className="bl-warn">Only record money you can see has arrived in the bank account.</p>
      <div className="cs-grid">
        <label><span>Amount received</span><input inputMode="decimal" placeholder="£0.00" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></label>
        <label><span>Date it arrived</span><input type="date" value={v.receivedOn} onChange={(e) => setV({ ...v, receivedOn: e.target.value })} /></label>
        <label><span>Bank reference</span><input value={v.reference} placeholder="As shown on the statement" onChange={(e) => setV({ ...v, reference: e.target.value })} /></label>
        <label>
          <span>Put it against</span>
          <select value={v.allocateTo} onChange={(e) => setV({ ...v, allocateTo: e.target.value })}>
            {openInvoices.map((i) => <option key={i.id} value={i.id}>{i.number} · {formatPence(i.balance)} owed</option>)}
            <option value="">Nothing yet (keep unallocated)</option>
          </select>
        </label>
        <label className="bl-wide"><span>Note (optional)</span><input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></label>
      </div>
      {dup ? (
        <p className="bl-warn" role="alert">
          A payment of {formatPence(dup.amount_pence)} on {dup.received_on}
          {dup.reference ? ` (ref ${dup.reference})` : ""} is already recorded for this client. Is this a different payment?
        </p>
      ) : null}
      <div className="cs-actions">
        <button type="button" className="btn btn-p" disabled={pending} onClick={() => go(false)}>{pending ? "Saving…" : "Record payment"}</button>
        {dup ? <button type="button" className="btn btn-g" disabled={pending} onClick={() => go(true)}>It’s a different payment — record it</button> : null}
        <button type="button" className="au-text-link as-btn" onClick={() => { setOpen(false); setDup(null); setErr(null); }}>Cancel</button>
        {err && !dup ? <span className="clear-err" role="alert">{err}</span> : null}
      </div>
    </div>
  );
}

export function AllocatePayment({ receiptId, clientId, unapplied, openInvoices }: { receiptId: string; clientId: string; unapplied: number; openInvoices: { id: string; number: string; balance: number }[] }) {
  if (!openInvoices.length) return null;
  const first = openInvoices[0];
  return (
    <ActionForm
      open="Allocate"
      submit="Allocate"
      tone="link"
      fields={[
        { name: "invoice", label: "Invoice", kind: "select", options: openInvoices.map((i) => [i.id, `${i.number} · ${formatPence(i.balance)} owed`]) },
        { name: "amount", label: "Amount", kind: "money", initial: penceToInput(Math.min(unapplied, first.balance)) },
      ]}
      run={(v) => allocatePayment({ receiptId, invoiceId: v.invoice, amount: v.amount, clientId })}
    />
  );
}

export function ReverseAllocation({ allocationId, clientId }: { allocationId: string; clientId: string }) {
  return (
    <ActionForm
      open="Undo"
      submit="Undo this allocation"
      tone="link"
      warning="The money goes back to unallocated. Session credits already granted stay; adjust them separately if needed."
      fields={[{ name: "reason", label: "Reason", kind: "text", placeholder: "e.g. put against the wrong invoice" }]}
      run={(v) => reverseAllocation({ allocationId, reason: v.reason, clientId })}
    />
  );
}

export function RefundPayment({ receiptId, clientId, unapplied }: { receiptId: string; clientId: string; unapplied: number }) {
  return (
    <ActionForm
      open="Record refund"
      submit="Record refund"
      tone="link"
      warning="Record a refund only after you’ve sent the money back. Only unallocated money can be refunded."
      fields={[
        { name: "amount", label: "Amount refunded", kind: "money", initial: penceToInput(unapplied) },
        { name: "date", label: "Date refunded", kind: "date", initial: todayUk() },
        { name: "reason", label: "Reason", kind: "text" },
      ]}
      run={(v) => recordRefund({ receiptId, amount: v.amount, reason: v.reason, refundedOn: v.date, clientId })}
    />
  );
}

export function ReversePayment({ receiptId, clientId }: { receiptId: string; clientId: string }) {
  return (
    <ActionForm
      open="Entered in error"
      submit="Mark as entered in error"
      tone="link"
      warning="For a payment recorded by mistake. It stays on record, marked reversed."
      fields={[{ name: "reason", label: "Reason", kind: "text" }]}
      run={(v) => reversePayment({ receiptId, reason: v.reason, clientId })}
    />
  );
}

export function AdjustCredits({ clientId }: { clientId: string }) {
  return (
    <ActionForm
      open="Adjust credits"
      submit="Save adjustment"
      tone="link"
      warning="For complimentary sessions or corrections. It’s recorded with your name and reason."
      fields={[
        { name: "qty", label: "Change (e.g. 1 or -1)", kind: "number", initial: "1" },
        { name: "reason", label: "Reason", kind: "text" },
      ]}
      run={(v) => adjustCredits({ clientId, quantity: Number(v.qty), reason: v.reason, operationKey: newKey() })}
    />
  );
}

export function NoticeActions({ noticeId, clientId }: { noticeId: string; clientId: string }) {
  return (
    <span className="bl-act">
      <ActionForm open="Found it" submit="Mark as found" tone="link" fields={[]} run={() => markNotice({ noticeId, status: "matched", clientId })} />
      <ActionForm open="Not found" submit="Mark as not found" tone="link" fields={[]} run={() => markNotice({ noticeId, status: "not_found", clientId })} />
    </span>
  );
}

export function NoShowCredit({ sessionId, clientId }: { sessionId: string; clientId: string }) {
  return (
    <span className="bl-act">
      <ActionForm
        open="Use the credit"
        submit="Use the credit"
        tone="link"
        fields={[{ name: "reason", label: "Reason", kind: "text", placeholder: "e.g. less than 24 hours’ notice" }]}
        run={(v) => resolveNoShowCredit({ sessionId, use: true, reason: v.reason, clientId })}
      />
      <ActionForm open="Give it back" submit="Release the credit" tone="link" fields={[]} run={() => resolveNoShowCredit({ sessionId, use: false, reason: "", clientId })} />
    </span>
  );
}

// Start a draft invoice from one of the packages, to check and issue as usual.
export function InvoiceFromPackage({ clientId, packages }: { clientId: string; packages: { id: string; label: string }[] }) {
  const router = useRouter();
  const [choice, setChoice] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!packages.length) return null;
  return (
    <span className="bl-act">
      <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Package">
        <option value="">From a package…</option>
        {packages.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <button
        type="button"
        className="btn btn-g"
        disabled={pending || !choice}
        onClick={async () => {
          setPending(true);
          setErr(null);
          const r = await draftInvoiceFromPackage(clientId, choice);
          setPending(false);
          if (!r.ok) return setErr(r.message);
          setChoice("");
          router.refresh();
        }}
      >
        {pending ? "Starting…" : "Draft invoice"}
      </button>
      {err ? <span className="clear-err" role="alert">{err}</span> : null}
    </span>
  );
}
