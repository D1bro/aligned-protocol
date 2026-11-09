"use client";

import { useState } from "react";
import { assignCoach, setRole, type StaffMember } from "@/lib/actions/admin";

// Admin only: who coaches this person, and what kind of account it is.
export function ClientSettings({
  clientId,
  role,
  coachId,
  staff,
  isSelf,
}: {
  clientId: string;
  role: "client" | "coach" | "admin";
  coachId: string | null;
  staff: StaffMember[];
  isSelf: boolean;
}) {
  const [coach, setCoach] = useState(coachId ?? "");
  const [kind, setKind] = useState(role);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveCoach(next: string) {
    const prev = coach;
    setCoach(next);
    setPending(true);
    setNote(null);
    const result = await assignCoach(clientId, next || null);
    setPending(false);
    if (!result.ok) {
      setCoach(prev);
      return setNote({ ok: false, text: result.message ?? "Couldn’t save." });
    }
    setNote({ ok: true, text: next ? "Coach assigned." : "Coach removed." });
  }

  async function saveRole(next: "client" | "coach" | "admin") {
    if (next !== "client" && !window.confirm(`Give this account ${next} access? They'll see the console${next === "admin" ? ", every client and site settings" : " and their assigned clients"}.`)) return;
    const prev = kind;
    setKind(next);
    setPending(true);
    setNote(null);
    const result = await setRole(clientId, next);
    setPending(false);
    if (!result.ok) {
      setKind(prev);
      return setNote({ ok: false, text: result.message ?? "Couldn’t save." });
    }
    setNote({ ok: true, text: `Account is now: ${next}.` });
  }

  return (
    <div className="admin-settings">
      <label>
        <span>Coach</span>
        <select value={coach} disabled={pending} onChange={(e) => saveCoach(e.target.value)}>
          <option value="">No coach</option>
          {staff.filter((s) => s.id !== clientId).map((s) => (
            <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Account type</span>
        <select value={kind} disabled={pending || isSelf} onChange={(e) => saveRole(e.target.value as typeof kind)}>
          <option value="client">Client</option>
          <option value="coach">Coach</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <p className={note ? (note.ok ? "admin-ok" : "clear-err") : "admin-hint"} role="status">
        {note?.text ?? (isSelf ? "This is your account." : "Changes save straight away.")}
      </p>
      <p className="admin-hint">
        <b>Coach</b> is who coaches them: whose console they appear in. <b>Account type</b> is what they can open, not what they
        pay: a <b>client</b> has their member area only; a <b>coach</b> also has the console with their assigned clients; an{" "}
        <b>admin</b> sees every client, the numbers and site settings. Memberships and packages are separate (Payments and invoices).
      </p>
    </div>
  );
}
