"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToTeam, changeTeamRole, setBilling, type TeamMember } from "@/lib/actions/team";

type Role = "client" | "coach" | "admin";
type Note = { ok: boolean; text: string } | null;

// The team list (role and billing access per person) and adding someone new.
export function TeamEditor({ meId, canBill, members }: { meId: string; canBill: boolean; members: TeamMember[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<"coach" | "admin">("coach");
  const [addNote, setAddNote] = useState<Note>(null);

  const note = (id: string, n: Note) => setNotes((all) => ({ ...all, [id]: n }));

  async function saveRole(m: TeamMember, role: Role) {
    const who = m.full_name || m.email || "this person";
    const ask =
      role === "client"
        ? `Remove ${who} from the team? They keep their own account as a member, and lose console access.`
        : role === "admin"
          ? `Make ${who} an admin? They'll see every client, the numbers and site settings.`
          : `Make ${who} a coach? They'll only see their own clients${m.can_manage_billing ? ", and lose billing access" : ""}.`;
    if (!window.confirm(ask)) return;
    setBusy(m.id);
    note(m.id, null);
    const r = await changeTeamRole(m.id, role);
    setBusy(null);
    if (!r.ok) return note(m.id, { ok: false, text: r.message });
    note(m.id, { ok: true, text: role === "client" ? "Removed from the team." : "Saved." });
    router.refresh();
  }

  async function saveBilling(m: TeamMember, on: boolean) {
    const who = m.full_name || m.email || "this person";
    if (on && !window.confirm(`Give ${who} billing access? They'll be able to issue invoices, record payments and change packages.`)) return;
    setBusy(m.id);
    note(m.id, null);
    const r = await setBilling(m.id, on);
    setBusy(null);
    if (!r.ok) return note(m.id, { ok: false, text: r.message });
    note(m.id, { ok: true, text: on ? "Billing access given." : "Billing access removed." });
    router.refresh();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    setAddNote(null);
    const r = await addToTeam(email, newRole);
    setBusy(null);
    setAddNote({ ok: r.ok, text: r.message ?? "Added." });
    if (r.ok) {
      setEmail("");
      router.refresh();
    }
  }

  return (
    <>
      <ul className="team-list">
        {members.map((m) => {
          const self = m.id === meId;
          const billingHint = !canBill
            ? "Only someone with billing access can change this."
            : m.role !== "admin"
              ? "Admins only."
              : self && m.can_manage_billing
                ? "You can’t remove your own."
                : null;
          const n = notes[m.id];
          return (
            <li key={m.id}>
              <div className="team-who">
                <b>{m.full_name || "No name yet"}{self ? <span className="team-you">You</span> : null}</b>
                <span>{m.email ?? "No email"}</span>
                <span>{m.clients ? `Coach to ${m.clients} client${m.clients === 1 ? "" : "s"}` : "No clients assigned"}</span>
              </div>
              <div className="team-controls">
                <label>
                  <span>Role</span>
                  <select value={m.role} disabled={busy !== null || self} onChange={(e) => saveRole(m, e.target.value as Role)}>
                    <option value="coach">Coach</option>
                    <option value="admin">Admin</option>
                    <option value="client">Remove from team</option>
                  </select>
                </label>
                <label className="team-check" title={billingHint ?? undefined}>
                  <input
                    type="checkbox"
                    checked={m.can_manage_billing && m.role === "admin"}
                    disabled={busy !== null || billingHint !== null}
                    onChange={(e) => saveBilling(m, e.target.checked)}
                  />
                  Billing access
                </label>
              </div>
              <p className={n ? (n.ok ? "admin-ok" : "clear-err") : "admin-hint"} role="status">
                {n?.text ?? (self ? "This is your account." : billingHint && m.role === "admin" ? billingHint : "")}
              </p>
            </li>
          );
        })}
      </ul>

      <form className="admin-card team-add" onSubmit={add}>
        <h2>Add someone to the team</h2>
        <p className="admin-hint">They need an account first: ask them to sign up on the site with their email, then add them here.</p>
        <div className="team-add-row">
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
          </label>
          <label>
            <span>As</span>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as "coach" | "admin")}>
              <option value="coach">Coach</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button type="submit" className="btn btn-o" disabled={busy !== null || !email.trim()}>
            {busy === "add" ? "Adding…" : "Add"}
          </button>
        </div>
        {addNote ? <p className={addNote.ok ? "admin-ok" : "clear-err"} role="status">{addNote.text}</p> : null}
      </form>
    </>
  );
}
