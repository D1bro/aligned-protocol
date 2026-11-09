"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveMyCoachBasics, type CoachBasics } from "@/lib/actions/staff-profiles";

// A photo shrunk to at most 600px, as JPEG (keeps it well under 2 MB).
async function shrink(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88));
  } catch {
    return null;
  }
}

// The coach's basics: name, contact, photo, bio, credentials and meeting
// defaults. Admins can see these; the coach's clients see name, photo, bio
// and credentials.
export function CoachBasicsEditor({ initial, zones }: { initial: CoachBasics; zones: string[] }) {
  const [v, setV] = useState({
    fullName: initial.fullName,
    phone: initial.phone,
    timezone: initial.timezone,
    bio: initial.bio,
    credentials: initial.credentials,
    meetingLink: initial.meetingLink,
    defaultMinutes: initial.defaultMinutes,
    photoPath: initial.photoPath,
  });
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<typeof v>) => {
    setV((x) => ({ ...x, ...patch }));
    setDirty(true);
    setNote(null);
  };

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setNote(null);
    const blob = await shrink(file);
    if (!blob) {
      setBusy(false);
      return setNote({ ok: false, text: "That image couldn’t be read. Try a JPEG or PNG." });
    }
    const path = `${initial.id}/${crypto.randomUUID()}.jpg`;
    const { error } = await createClient().storage.from("coach-photos").upload(path, blob, { contentType: "image/jpeg" });
    setBusy(false);
    if (error) return setNote({ ok: false, text: "Couldn’t upload the photo — try again." });
    setPhotoUrl(URL.createObjectURL(blob));
    set({ photoPath: path });
  }

  async function save() {
    setBusy(true);
    const r = await saveMyCoachBasics(v);
    setBusy(false);
    if (!r.ok) return setNote({ ok: false, text: r.message });
    setDirty(false);
    setNote({ ok: true, text: "Saved." });
  }

  return (
    <section className="admin-card cpf-basics" aria-labelledby="cpf-basics-h">
      <h2 id="cpf-basics-h">About me</h2>
      <p className="admin-card-sub">Admins can see this. Your clients see your name, photo, bio and credentials on their Coaching page.</p>
      <div className="cpf-photo">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the coach's own uploaded photo
          <img src={photoUrl} alt="" />
        ) : (
          <span className="cpf-photo-empty" aria-hidden="true">{v.fullName.trim().charAt(0).toUpperCase() || "?"}</span>
        )}
        <label className="journal-add-image">
          <input type="file" accept="image/*" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
          {photoUrl ? "Change photo" : "+ Add a photo"}
        </label>
        {photoUrl ? <button type="button" className="au-text-link as-btn" onClick={() => { setPhotoUrl(null); set({ photoPath: null }); }}>Remove</button> : null}
      </div>
      <div className="cpf-grid">
        <label><span>Name</span><input type="text" maxLength={120} value={v.fullName} onChange={(e) => set({ fullName: e.target.value })} /></label>
        <label><span>Email</span><input type="email" value={initial.email ?? ""} disabled /></label>
        <label><span>Phone</span><input type="tel" maxLength={40} value={v.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
        <label>
          <span>Time zone</span>
          <select value={v.timezone} onChange={(e) => set({ timezone: e.target.value })}>
            <option value="">Not set</option>
            {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
        </label>
      </div>
      <label className="cpf-wide"><span>Short bio</span><textarea rows={4} maxLength={1500} value={v.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="A few sentences your clients will read" /></label>
      <label className="cpf-wide"><span>Credentials</span><textarea rows={2} maxLength={1000} value={v.credentials} onChange={(e) => set({ credentials: e.target.value })} placeholder="Qualifications, accreditations, experience" /></label>
      <h3 className="desk-h3">Meeting defaults</h3>
      <p className="admin-card-sub">Filled in for you when you book a session; you can still change them per session.</p>
      <div className="cpf-grid">
        <label><span>Usual meeting link</span><input type="url" maxLength={500} placeholder="https://meet.google.com/…" value={v.meetingLink} onChange={(e) => set({ meetingLink: e.target.value })} /></label>
        <label><span>Usual length (minutes)</span><input type="number" min={15} max={240} step={5} value={v.defaultMinutes} onChange={(e) => set({ defaultMinutes: Number(e.target.value) })} /></label>
      </div>
      <p className="admin-hint">Your email is the one you sign in with; to change it, contact the site admin.</p>
      <div className="cs-actions">
        <button type="button" className="btn btn-p" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        {note ? <span className={note.ok ? "admin-ok" : "clear-err"} role="status">{note.text}</span> : dirty ? <span className="admin-card-sub">Not saved yet</span> : null}
      </div>
    </section>
  );
}
