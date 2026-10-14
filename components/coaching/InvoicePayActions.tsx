"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { payInvoiceByCard, tellCoachIPaid } from "@/lib/actions/billing";

// Pay by card (when switched on), or say a bank transfer has been sent so
// Duane knows to look for it. Neither marks the invoice paid by itself.
export function InvoicePayActions({ invoiceId, card, noticeSent }: { invoiceId: string; card: boolean; noticeSent: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | "notice">(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function pay() {
    setPending(true);
    setMsg(null);
    const r = await payInvoiceByCard(invoiceId);
    if (!r.ok || !("url" in r) || !r.url) {
      setPending(false);
      return setMsg({ ok: false, text: r.ok ? "Couldn’t open the payment page." : r.message });
    }
    window.location.assign(r.url);
  }

  async function notify() {
    setPending(true);
    const r = await tellCoachIPaid(invoiceId, note);
    setPending(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setMode(null);
    setMsg({ ok: true, text: "Thanks — Duane will check and confirm." });
    router.refresh();
  }

  if (mode === "notice") {
    return (
      <div className="cs-inline">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="When you sent it (optional)" aria-label="When you sent it" />
        <button type="button" className="btn btn-g" disabled={pending} onClick={notify}>{pending ? "Sending…" : "Let Duane know"}</button>
        <button type="button" className="au-text-link as-btn" onClick={() => setMode(null)}>Back</button>
      </div>
    );
  }
  return (
    <span className="bl-act">
      {card ? (
        <button type="button" className="btn btn-p bl-btn" disabled={pending} onClick={pay}>{pending ? "Opening…" : "Pay by card"}</button>
      ) : null}
      {noticeSent ? (
        <span className="cs-meta">You’ve told Duane it’s paid — he’ll confirm once it arrives.</span>
      ) : (
        <button type="button" className="au-text-link as-btn" onClick={() => setMode("notice")}>I’ve paid by bank transfer</button>
      )}
      {msg ? <span className={msg.ok ? "bl-ok" : "clear-err"} role="status">{msg.text}</span> : null}
    </span>
  );
}
