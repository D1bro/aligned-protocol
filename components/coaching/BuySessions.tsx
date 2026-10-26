"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buyPackage, type Package } from "@/lib/actions/packages";
import { formatPence } from "@/lib/money";

const ukDate = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

// "Your sessions": what's left, when it runs out, and packages to buy or top
// up with. Buying issues an invoice just below, paid by card or bank
// transfer; the sessions are added once it's paid in full.
export function BuySessions({
  packages,
  credits,
  expiries,
  coached,
}: {
  packages: Package[];
  credits: { balance: number; reserved: number; available: number } | null;
  expiries: { expires_at: string; quantity: number }[];
  coached: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const held = credits ? credits.available + credits.reserved : 0;
  if (!packages.length && !held) return null;
  const low = coached && credits !== null && credits.available <= 1;
  const next = expiries[0] ?? null;

  async function buy(p: Package) {
    if (!window.confirm(`Buy ${p.name} for ${formatPence(p.price_pence)}? We'll issue your invoice now, to pay by card or bank transfer.`)) return;
    setBusy(p.id);
    setMsg(null);
    const r = await buyPackage(p.id);
    setBusy(null);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setMsg({ ok: true, text: "Your invoice is ready below. Pay by card or bank transfer; your sessions are added once it's paid." });
    router.refresh();
    setTimeout(() => document.getElementById("mi-h")?.scrollIntoView({ behavior: "smooth", block: "start" }), 600);
  }

  return (
    <section className="mc bs" id="buy" aria-labelledby="bs-h">
      <h2 id="bs-h" className="mc-title">Your sessions</h2>
      <div className="bs-balance">
        <p>
          <b>{credits?.available ?? 0}</b> session{credits?.available === 1 ? "" : "s"} available to book
          {credits?.reserved ? <span> · {credits.reserved} set aside for sessions already booked</span> : null}
        </p>
        {next ? (
          <p className="admin-card-sub">
            {next.quantity} session{next.quantity === 1 ? "" : "s"} to use by {ukDate(next.expires_at)}.
          </p>
        ) : null}
        {low && packages.length ? (
          <p className="bs-low">{credits!.available === 0 ? "You have no sessions left." : "You're on your last session."} Top up below to keep going.</p>
        ) : null}
      </div>
      {packages.length ? (
        <ul className="bs-list">
          {packages.map((p) => (
            <li key={p.id}>
              <div>
                <h3>{p.name}</h3>
                {p.description ? <p className="sw-p">{p.description}</p> : null}
                <p className="admin-card-sub">
                  {p.sessions} session{p.sessions === 1 ? "" : "s"}
                  {p.sessions > 1 ? ` · ${formatPence(Math.round(p.price_pence / p.sessions))} each` : ""}
                  {p.valid_days ? ` · use within ${p.valid_days} days of paying` : ""}
                  {p.available_until ? ` · on offer until ${ukDate(p.available_until)}` : ""}
                </p>
              </div>
              <button type="button" className="btn btn-p" disabled={busy !== null} onClick={() => buy(p)}>
                {busy === p.id ? "Preparing…" : `Buy · ${formatPence(p.price_pence)}`}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {msg ? <p className={msg.ok ? "bl-ok" : "clear-err"} role="status">{msg.text}</p> : null}
    </section>
  );
}
