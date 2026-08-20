"use client";

import { useState, useTransition } from "react";
import { addClient } from "@/lib/actions/coach";
import { Notice } from "@/components/ui/Notice";

export function AddClientForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const res = await addClient(formData);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setOk(res.message || "Invite sent.");
      setOpen(false);
    });
  }

  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <Notice type="ok">{ok}</Notice>
      {!open ? (
        <button
          type="button"
          className="btn btn-o"
          onClick={() => {
            setOpen(true);
            setOk("");
          }}
        >
          + Add a client
        </button>
      ) : (
        <div className="card" style={{ maxWidth: 480 }}>
          <form action={handleSubmit}>
            <label className="lbl" htmlFor="fullName">Full name</label>
            <input id="fullName" name="fullName" placeholder="Client's full name" required />
            <label className="lbl" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="client@email.com" required />
            <div style={{ display: "flex", gap: ".75rem", marginTop: "1rem" }}>
              <button className="btn btn-p" disabled={pending}>
                {pending ? "Sending invite…" : "Send invite"}
              </button>
              <button type="button" className="btn btn-g" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </form>
          <Notice type="err">{error}</Notice>
        </div>
      )}
    </div>
  );
}
