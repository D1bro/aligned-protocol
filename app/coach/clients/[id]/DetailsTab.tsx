"use client";

import { useState } from "react";
import Link from "next/link";
import { saveAdminNotes, saveClientRecord, staffSaveClientDetails, type ClientRecord } from "@/lib/actions/staff-profiles";

type Note = { ok: boolean; text: string } | null;
type Contact = { fullName: string; preferredName: string; phone: string; town: string; country: string; timezone: string };

function Saved({ note, dirty }: { note: Note; dirty: boolean }) {
  return note ? <span className={note.ok ? "admin-ok" : "clear-err"} role="status">{note.text}</span> : dirty ? <span className="admin-card-sub">Not saved yet</span> : null;
}

// A client's admin details in the console: contact details (edited for them),
// their record (status, start, how they found you) and, for admins, private
// admin notes. Billing details live on the Payments tab.
export function DetailsTab({
  clientId,
  firstName,
  contact,
  record,
  adminNotes,
  zones,
  canBill,
}: {
  clientId: string;
  firstName: string;
  contact: Contact;
  record: ClientRecord;
  adminNotes: string | null;
  zones: string[];
  canBill: boolean;
}) {
  const [c, setC] = useState(contact);
  const [r, setR] = useState({ status: record.status, startedOn: record.startedOn, source: record.source });
  const [n, setN] = useState(adminNotes ?? "");
  const [dirty, setDirty] = useState({ c: false, r: false, n: false });
  const [note, setNote] = useState<{ c: Note; r: Note; n: Note }>({ c: null, r: null, n: null });
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: "c" | "r" | "n", step: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(key);
    const res = await step();
    setBusy(null);
    setNote((x) => ({ ...x, [key]: res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.message ?? "Couldn’t save." } }));
    if (res.ok) setDirty((d) => ({ ...d, [key]: false }));
  }
  const field = (key: keyof Contact, label: string, type = "text", max = 120) => (
    <label>
      <span>{label}</span>
      <input type={type} maxLength={max} value={c[key]} onChange={(e) => { setC({ ...c, [key]: e.target.value }); setDirty((d) => ({ ...d, c: true })); setNote((x) => ({ ...x, c: null })); }} />
    </label>
  );

  return (
    <div className="cd">
      <section className="admin-card" aria-labelledby="cd-contact-h">
        <h2 id="cd-contact-h">Contact details</h2>
        <p className="admin-card-sub">Changes here update {firstName}&rsquo;s own &ldquo;Your details&rdquo;. Their email is their sign-in, so it isn&rsquo;t changed here.</p>
        <div className="cpf-grid">
          {field("fullName", "Name")}
          {field("preferredName", "Preferred name", "text", 80)}
          {field("phone", "Phone", "tel", 40)}
          {field("town", "Town or city")}
          {field("country", "Country", "text", 80)}
          <label>
            <span>Time zone</span>
            <select value={c.timezone} onChange={(e) => { setC({ ...c, timezone: e.target.value }); setDirty((d) => ({ ...d, c: true })); }}>
              <option value="">Not set</option>
              {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
            </select>
          </label>
        </div>
        <div className="cs-actions">
          <button type="button" className="btn btn-g" disabled={!dirty.c || busy !== null} onClick={() => run("c", () => staffSaveClientDetails(clientId, c))}>{busy === "c" ? "Saving…" : "Save contact details"}</button>
          <Saved note={note.c} dirty={dirty.c} />
        </div>
      </section>

      <section className="admin-card" aria-labelledby="cd-record-h">
        <h2 id="cd-record-h">Client record</h2>
        <p className="admin-card-sub">For you and {firstName}&rsquo;s coach. {firstName} doesn&rsquo;t see this.</p>
        <div className="cpf-grid">
          <label>
            <span>Status</span>
            <select value={r.status} onChange={(e) => { setR({ ...r, status: e.target.value as ClientRecord["status"] }); setDirty((d) => ({ ...d, r: true })); setNote((x) => ({ ...x, r: null })); }}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="former">Former client</option>
            </select>
          </label>
          <label>
            <span>Coaching started</span>
            <input type="date" value={r.startedOn} onChange={(e) => { setR({ ...r, startedOn: e.target.value }); setDirty((d) => ({ ...d, r: true })); }} />
          </label>
          <label>
            <span>How they found you</span>
            <input type="text" maxLength={200} placeholder="e.g. Instagram, a referral from…" value={r.source} onChange={(e) => { setR({ ...r, source: e.target.value }); setDirty((d) => ({ ...d, r: true })); }} />
          </label>
        </div>
        <div className="cs-actions">
          <button type="button" className="btn btn-g" disabled={!dirty.r || busy !== null} onClick={() => run("r", () => saveClientRecord(clientId, r))}>{busy === "r" ? "Saving…" : "Save record"}</button>
          <Saved note={note.r} dirty={dirty.r} />
        </div>
      </section>

      {adminNotes !== null ? (
        <section className="admin-card" aria-labelledby="cd-notes-h">
          <h2 id="cd-notes-h">Admin notes</h2>
          <p className="admin-card-sub">Admins only: not coaches, not {firstName}. Separate from coaching notes.</p>
          <label className="sr-only" htmlFor="cd-notes">Admin notes</label>
          <textarea id="cd-notes" rows={5} maxLength={4000} value={n} onChange={(e) => { setN(e.target.value); setDirty((d) => ({ ...d, n: true })); setNote((x) => ({ ...x, n: null })); }} />
          <div className="cs-actions">
            <button type="button" className="btn btn-g" disabled={!dirty.n || busy !== null} onClick={() => run("n", () => saveAdminNotes(clientId, n))}>{busy === "n" ? "Saving…" : "Save notes"}</button>
            <Saved note={note.n} dirty={dirty.n} />
          </div>
        </section>
      ) : null}

      <section className="admin-card" aria-labelledby="cd-billing-h">
        <h2 id="cd-billing-h">Billing details</h2>
        <p className="admin-card-sub">
          The name, email and address used on invoices are on{" "}
          {canBill ? <Link href={`/coach/clients/${clientId}?tab=billing`}>Payments and invoices</Link> : "Payments and invoices (billing access needed)"}.
        </p>
      </section>
    </div>
  );
}
