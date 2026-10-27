"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePackage, type AdminPackage } from "@/lib/actions/packages";
import { formatPence, penceToInput } from "@/lib/money";

type Draft = {
  id: string | null;
  name: string;
  description: string;
  price: string;
  sessions: string;
  validDays: string;
  availableFrom: string;
  availableUntil: string;
  audience: "everyone" | "selected";
  clientIds: string[];
  active: boolean;
  includesMembership: "" | "practice" | "momentum";
};

const blank: Draft = { id: null, name: "", description: "", price: "", sessions: "4", validDays: "", availableFrom: "", availableUntil: "", audience: "everyone", clientIds: [], active: true, includesMembership: "" };
const toDraft = (p: AdminPackage): Draft => ({
  id: p.id,
  name: p.name,
  description: p.description ?? "",
  price: penceToInput(p.price_pence),
  sessions: String(p.sessions),
  validDays: p.valid_days ? String(p.valid_days) : "",
  availableFrom: p.available_from ?? "",
  availableUntil: p.available_until ?? "",
  audience: p.audience,
  clientIds: p.clientIds,
  active: p.active,
  includesMembership: p.includes_membership ?? "",
});
const ukDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// One line per package, with a form to add or edit. Retiring (unticking
// "On sale") hides it from clients without touching anything already sold.
export function PackagesEditor({ packages, clients }: { packages: AdminPackage[]; clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<Draft>) => setD((x) => (x ? { ...x, ...patch } : x));

  async function save() {
    if (!d) return;
    setBusy(true);
    setMsg(null);
    const r = await savePackage(d);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    setMsg({ ok: true, text: "Saved." });
    setD(null);
    router.refresh();
  }

  const perSession = d && Number(d.sessions) > 0 && Number(d.price) > 0 ? Number(d.price) / Number(d.sessions) : null;

  return (
    <div className="pk">
      <ul className="pk-list">
        {packages.map((p) => (
          <li key={p.id} className={p.active ? undefined : "off"}>
            <div>
              <b>{p.name}</b>
              <span>
                {formatPence(p.price_pence)} · {p.sessions} session{p.sessions === 1 ? "" : "s"} ({formatPence(Math.round(p.price_pence / p.sessions))} each)
                {p.valid_days ? ` · use within ${p.valid_days} days` : " · no expiry"}
              </span>
              <span>
                {p.active ? "On sale" : "Retired"}
                {p.available_from ? ` · from ${ukDate(p.available_from)}` : ""}
                {p.available_until ? ` · until ${ukDate(p.available_until)}` : ""}
                {p.audience === "everyone" ? " · everyone" : ` · ${p.clientIds.length} chosen client${p.clientIds.length === 1 ? "" : "s"}`}
                {p.sold ? ` · ${p.sold} sold` : ""}
              </span>
            </div>
            <button type="button" className="au-text-link as-btn" onClick={() => { setD(toDraft(p)); setMsg(null); }}>Edit</button>
          </li>
        ))}
        {!packages.length ? <li className="pk-empty">No packages yet. Add your first one below.</li> : null}
      </ul>

      {!d ? (
        <button type="button" className="btn btn-p" onClick={() => { setD({ ...blank }); setMsg(null); }}>+ Add a package</button>
      ) : (
        <div className="admin-card pk-form">
          <h2>{d.id ? "Edit package" : "New package"}</h2>
          <label className="sw-field">
            <span>Name</span>
            <input type="text" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Block of 4 sessions" />
          </label>
          <label className="sw-field">
            <span>Description (optional, clients see it)</span>
            <textarea rows={2} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Four sessions, fortnightly, with notes after each" />
          </label>
          <div className="cs-grid pk-grid">
            <label className="sw-field">
              <span>Price (£)</span>
              <input type="text" inputMode="decimal" value={d.price} onChange={(e) => set({ price: e.target.value })} placeholder="300" />
            </label>
            <label className="sw-field">
              <span>Sessions</span>
              <input type="number" min={1} max={100} value={d.sessions} onChange={(e) => set({ sessions: e.target.value })} />
            </label>
            <label className="sw-field">
              <span>Use within (days)</span>
              <input type="number" min={1} max={730} value={d.validDays} onChange={(e) => set({ validDays: e.target.value })} placeholder="Blank = no expiry" />
            </label>
          </div>
          {perSession ? <em className="admin-card-sub">That&rsquo;s £{perSession.toFixed(2)} per session.</em> : null}
          <label className="sw-field">
            <span>Includes a membership (for Aligned Focus)</span>
            <select value={d.includesMembership} onChange={(e) => set({ includesMembership: e.target.value as Draft["includesMembership"] })}>
              <option value="">No</option>
              <option value="practice">Aligned Practice</option>
              <option value="momentum">Aligned Momentum (includes Practice)</option>
            </select>
            <em className="admin-card-sub">Unlocked once it&rsquo;s fully paid, for its &ldquo;use within&rdquo; days (six weeks if blank). No automatic membership afterwards.</em>
          </label>
          <div className="cs-grid">
            <label className="sw-field">
              <span>On offer from (optional)</span>
              <input type="date" value={d.availableFrom} onChange={(e) => set({ availableFrom: e.target.value })} />
            </label>
            <label className="sw-field">
              <span>On offer until (optional)</span>
              <input type="date" value={d.availableUntil} onChange={(e) => set({ availableUntil: e.target.value })} />
            </label>
          </div>
          <div className="sw-field">
            <span>Who can buy it</span>
            <label className="admin-check">
              <input type="radio" name="aud" checked={d.audience === "everyone"} onChange={() => set({ audience: "everyone" })} /> Everyone signed in
            </label>
            <label className="admin-check">
              <input type="radio" name="aud" checked={d.audience === "selected"} onChange={() => set({ audience: "selected" })} /> Only clients I choose
            </label>
            {d.audience === "selected" ? (
              <div className="pk-clients">
                {clients.map((c) => (
                  <label key={c.id} className="admin-check">
                    <input
                      type="checkbox"
                      checked={d.clientIds.includes(c.id)}
                      onChange={(e) => set({ clientIds: e.target.checked ? [...d.clientIds, c.id] : d.clientIds.filter((x) => x !== c.id) })}
                    />{" "}
                    {c.name}
                  </label>
                ))}
                {!clients.length ? <em className="admin-card-sub">No clients yet.</em> : null}
              </div>
            ) : null}
          </div>
          <label className="admin-check">
            <input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} /> On sale (untick to retire it; anything already sold is unaffected)
          </label>
          <div className="cs-actions">
            <button type="button" className="btn btn-p" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save package"}</button>
            <button type="button" className="au-text-link as-btn" disabled={busy} onClick={() => setD(null)}>Cancel</button>
          </div>
        </div>
      )}
      {msg ? <p className={msg.ok ? "admin-ok" : "clear-err"} role="status">{msg.text}</p> : null}
    </div>
  );
}
