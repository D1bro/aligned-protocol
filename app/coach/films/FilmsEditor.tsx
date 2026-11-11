"use client";

import { useState } from "react";
import { saveFilmLink } from "@/lib/actions/films";
import { linkProblem, type FilmSlot } from "@/lib/films";

export function FilmsEditor({ slots, links }: { slots: FilmSlot[]; links: Record<string, string> }) {
  return (
    <ul className="films-list">
      {slots.map((s) => <FilmRow key={s.id} slot={s} initial={links[s.id] ?? ""} />)}
    </ul>
  );
}

function FilmRow({ slot, initial }: { slot: FilmSlot; initial: string }) {
  const [url, setUrl] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const problem = linkProblem(url, slot.kind);
  const id = `film-${slot.id}`;

  async function save() {
    setPending(true);
    setMsg(null);
    const r = await saveFilmLink(slot.id, url);
    setPending(false);
    if (r.ok) {
      setSaved(url.trim());
      setMsg({ text: url.trim() ? "Saved. It’s on the site now." : "Removed from the site." });
    } else setMsg({ text: r.message, error: true });
  }

  return (
    <li className="films-row">
      <div className="films-head">
        <label htmlFor={id}><b>{slot.title}</b></label>
        <span className="admin-card-sub">{slot.where} · {slot.kind === "audio" ? "Audio" : "Film"}</span>
        <span className={saved ? "films-state is-on" : "films-state"}>{saved ? "On the site" : "Not shown yet"}</span>
      </div>
      <div className="films-edit">
        <input
          id={id}
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={slot.kind === "audio" ? "https://…/daily-intention.mp3" : "https://youtu.be/…"}
          aria-invalid={!!problem || undefined}
          aria-describedby={`${id}-msg`}
        />
        <button type="button" className="btn btn-g" disabled={pending || !!problem || url.trim() === saved} onClick={save}>
          {pending ? "Saving…" : url.trim() || !saved ? "Save" : "Remove"}
        </button>
      </div>
      <p id={`${id}-msg`} className={problem || msg?.error ? "clear-err films-msg" : "admin-card-sub films-msg"} role="status">
        {problem ?? msg?.text ?? ""}
      </p>
    </li>
  );
}
