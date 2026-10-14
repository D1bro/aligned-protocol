"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBillingSettings, type BillingSettings } from "@/lib/actions/billing";

const FIELDS: { name: keyof BillingSettings; label: string; hint?: string; area?: boolean; group: string }[] = [
  { group: "Business", name: "trading_name", label: "Trading name" },
  { group: "Business", name: "legal_name", label: "Legal name", hint: "Your name as a sole trader, or the registered company name" },
  { group: "Business", name: "legal_form", label: "Legal form (optional)", hint: "e.g. Sole trader, or Ltd with company number" },
  { group: "Business", name: "address", label: "Business address", area: true },
  { group: "Business", name: "contact_email", label: "Billing contact email" },
  { group: "Business", name: "contact_phone", label: "Phone (optional)" },
  { group: "Getting paid", name: "bank_account_name", label: "Account name" },
  { group: "Getting paid", name: "bank_sort_code", label: "Sort code", hint: "12-34-56" },
  { group: "Getting paid", name: "bank_account_number", label: "Account number", hint: "8 digits" },
  { group: "Getting paid", name: "bank_note", label: "Payment note (optional)", area: true, hint: "e.g. Please use the invoice number as the reference" },
  { group: "Getting paid", name: "payment_terms_days", label: "Payment terms (days)" },
  { group: "Numbering", name: "invoice_prefix", label: "Invoice number prefix", hint: "Numbers run on from here: AM-0001, AM-0002…" },
  { group: "Numbering", name: "credit_note_prefix", label: "Credit note prefix" },
];

export function SettingsForm({ s }: { s: BillingSettings }) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.name, s[f.name] === null || s[f.name] === undefined ? "" : String(s[f.name])]))
  );
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setPending(true);
    setMsg(null);
    const r = await saveBillingSettings(v);
    setPending(false);
    setMsg({ ok: r.ok, text: r.message ?? "Saved." });
    if (r.ok) router.refresh();
  }

  return (
    <div className="admin-card cs-form">
      {["Business", "Getting paid", "Numbering"].map((g) => (
        <fieldset key={g} className="bl-fieldset">
          <legend>{g}</legend>
          <div className="cs-grid">
            {FIELDS.filter((f) => f.group === g).map((f) => (
              <label key={f.name} className={f.area ? "bl-wide" : undefined}>
                <span>{f.label}</span>
                {f.area ? (
                  <textarea rows={3} value={v[f.name]} placeholder={f.hint} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
                ) : (
                  <input value={v[f.name]} placeholder={f.hint} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <p className="cs-meta">VAT: not registered. Invoices say “Not VAT registered. No VAT is charged.” Currency: GBP.</p>
      <div className="cs-actions">
        <button type="button" className="btn btn-p" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save settings"}</button>
        {msg ? <span className={msg.ok ? "bl-ok" : "clear-err"} role={msg.ok ? "status" : "alert"}>{msg.text}</span> : null}
      </div>
    </div>
  );
}
