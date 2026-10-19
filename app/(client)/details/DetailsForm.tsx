"use client";

import { useEffect, useMemo, useState } from "react";
import { saveMyDetails } from "@/lib/actions/details";
import { localTimeLabel, type DetailsInput } from "@/lib/details";

type Field = keyof DetailsInput;

// One page, three sections. Saves everything together; says "Saved" only
// once the save has succeeded, and keeps what was typed if it fails.
export function DetailsForm({
  initial,
  email,
  hasCoach,
  zones,
  contactEmail,
}: {
  initial: DetailsInput;
  email: string | null;
  hasCoach: boolean;
  zones: string[];
  contactEmail: string;
}) {
  const [v, setV] = useState<DetailsInput>(initial);
  const [saved, setSaved] = useState<DetailsInput>(initial);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string; field?: Field } | null>(null);
  const [deviceZone, setDeviceZone] = useState<string | null>(null);
  const dirty = (Object.keys(v) as Field[]).some((k) => v[k] !== saved[k]);

  // Offered as a suggestion only; nothing is set until they choose it.
  useEffect(() => {
    try {
      setDeviceZone(Intl.DateTimeFormat().resolvedOptions().timeZone || null);
    } catch {
      setDeviceZone(null);
    }
  }, []);

  const groups = useMemo(() => {
    const by = new Map<string, string[]>();
    for (const z of zones) {
      const region = z.includes("/") ? z.split("/")[0] : "Other";
      by.set(region, [...(by.get(region) ?? []), z]);
    }
    return [...by.entries()];
  }, [zones]);

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    setStatus(null);
  };
  const err = (k: Field) => (status && !status.ok && status.field === k ? status.text : null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    const result = await saveMyDetails(v);
    setPending(false);
    if (!result.ok) return setStatus({ ok: false, text: result.message, field: result.field });
    setSaved(v);
    setStatus({ ok: true, text: "Saved." });
  }

  const now = localTimeLabel(v.timezone || null);

  return (
    <form onSubmit={save} className="details-form" noValidate>
      <section className="details-sec" aria-labelledby="about-h">
        <h2 id="about-h">About you</h2>
        <label>
          <span>Full name</span>
          <input value={v.fullName} onChange={set("fullName")} autoComplete="name" required aria-invalid={!!err("fullName")} />
          {err("fullName") ? <em className="clear-err">{err("fullName")}</em> : null}
        </label>
        <label>
          <span>Preferred name <small>optional</small></span>
          <input value={v.preferredName} onChange={set("preferredName")} autoComplete="nickname" placeholder="What you’d like to be called" />
          <em>Used when we greet you. Your full name stays on invoices and records.</em>
        </label>
        <div className="details-readonly">
          <span>Email you sign in with</span>
          <b>{email ?? "—"}</b>
          <em>
            To change it, email <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </em>
        </div>
      </section>

      <section className="details-sec" aria-labelledby="contact-h">
        <h2 id="contact-h">Contact and location</h2>
        <label>
          <span>Phone <small>optional</small></span>
          <input value={v.phone} onChange={set("phone")} type="tel" autoComplete="tel" inputMode="tel" placeholder="+44 7700 900123" aria-invalid={!!err("phone")} />
          {err("phone") ? <em className="clear-err">{err("phone")}</em> : <em>Include your country code. We won&rsquo;t use it for marketing.</em>}
        </label>
        <div className="details-pair">
          <label>
            <span>Town or city <small>optional</small></span>
            <input value={v.town} onChange={set("town")} autoComplete="address-level2" />
          </label>
          <label>
            <span>Country <small>optional</small></span>
            <input value={v.country} onChange={set("country")} autoComplete="country-name" />
          </label>
        </div>
        <label>
          <span>Time zone <small>optional</small></span>
          <select value={v.timezone} onChange={set("timezone")} aria-invalid={!!err("timezone")}>
            <option value="">Not set</option>
            {groups.map(([region, list]) => (
              <optgroup key={region} label={region}>
                {list.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
              </optgroup>
            ))}
          </select>
          {err("timezone") ? <em className="clear-err">{err("timezone")}</em> : null}
          {deviceZone && deviceZone !== v.timezone && zones.includes(deviceZone) ? (
            <button type="button" className="au-text-link as-btn details-suggest" onClick={() => { setV((x) => ({ ...x, timezone: deviceZone })); setStatus(null); }}>
              Use this device&rsquo;s time zone: {deviceZone.replace(/_/g, " ")}
            </button>
          ) : null}
          <em suppressHydrationWarning>
            {now ? `Your local time now: ${now}. ` : ""}Booked sessions keep their agreed time; changing this doesn&rsquo;t move them.
          </em>
        </label>
        <p className="details-note">
          {hasCoach
            ? "Your coach can see your name, preferred name, phone, town or city, country and time zone, to help arrange sessions."
            : "If you work with a coach, they’ll be able to see your name, preferred name, phone, town or city, country and time zone."}{" "}
          They don&rsquo;t see your billing details.
        </p>
      </section>

      <section className="details-sec" aria-labelledby="billing-h">
        <h2 id="billing-h">Billing details</h2>
        <p className="details-note">Only used on invoices, if you have coaching sessions. Changing them doesn&rsquo;t alter invoices already sent.</p>
        <label>
          <span>Name for invoices <small>optional</small></span>
          <input value={v.billingName} onChange={set("billingName")} autoComplete="billing name" placeholder="Leave blank to use your full name" />
        </label>
        <label>
          <span>Postal address <small>optional</small></span>
          <textarea value={v.billingAddress} onChange={set("billingAddress")} rows={4} autoComplete="billing street-address" placeholder={"House and street\nTown or city\nPostcode\nCountry"} aria-invalid={!!err("billingAddress")} />
          {err("billingAddress") ? <em className="clear-err">{err("billingAddress")}</em> : <em>Write it as you would on an envelope, in any country&rsquo;s format.</em>}
        </label>
      </section>

      <div className="details-actions">
        <button type="submit" className="btn btn-p" disabled={pending || !dirty}>{pending ? "Saving…" : "Save my details"}</button>
        <p className={status ? (status.ok ? "admin-ok" : "clear-err") : "admin-hint"} role="status" aria-live="polite">
          {status ? (status.field && !status.ok && status.field !== "billingAddress" ? "Check the field marked above." : status.text) : dirty ? "You have unsaved changes." : ""}
        </p>
      </div>
    </form>
  );
}
