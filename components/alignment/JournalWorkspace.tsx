"use client";

import { useEffect, useRef, useState } from "react";
import { deleteJournalEntry, exportJournal, saveJournalEntry, type JournalEntry } from "@/lib/actions/journal";
import { createClient } from "@/lib/supabase/client";
import { byMonth, IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES, PROMPTS, todaysPrompt, videoSite } from "@/lib/journal";
import { monthName } from "@/lib/life-months";
import { AREA_ICONS, Icon } from "@/components/ui/Icon";

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}

// Phone photos are large: shrink to at most 2000px and save as JPEG, which
// also keeps them under the 5 MB limit. Returns null if the browser can't
// read the file (then the original is used if it's small enough).
async function shrink(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85));
  } catch {
    return null;
  }
}

type Picture = { path: string; url: string };
export type JournalArea = { id: string; name: string; sort_order: number };
const FREE = "free";

// The one journal (Duane, 10 Nov 2026): choose where to write (free writing,
// or the section for one of the ten areas of your chart), pick the day, and
// write freely. Prompts, a link to a Next Step, images and a video link are
// there if wanted, folded away. Read back by section and month, edit, delete,
// export.
// Nothing is saved until "Save privately"; there's no autosave or local
// storage. Images go straight to the member's private folder; any added but
// not saved are removed again on cancel.
export function JournalWorkspace({
  initial,
  today,
  canWrite,
  userId,
  goals,
  planPrompts,
  areas,
  startArea = FREE,
  showEverySection = false,
  startWriting = false,
}: {
  initial: JournalEntry[];
  today: string;
  canWrite: boolean;
  userId: string;
  goals: { id: string; title: string }[];
  planPrompts: string[];
  areas: JournalArea[];
  // "free", or a life area's id (?area= on the journal page).
  startArea?: string;
  // Searching by words or month: show matches from every section.
  showEverySection?: boolean;
  startWriting?: boolean;
}) {
  const prompts = [...planPrompts, todaysPrompt(today), ...PROMPTS.filter((p) => p !== todaysPrompt(today)).slice(0, 3)];
  const [entries, setEntries] = useState(initial);
  const [section, setSection] = useState(areas.some((a) => a.id === startArea) ? startArea : FREE);
  const [showAll, setShowAll] = useState(showEverySection);
  const [extras, setExtras] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [goalId, setGoalId] = useState("");
  const [video, setVideo] = useState("");
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (startWriting && canWrite) bodyRef.current?.focus();
  }, [startWriting, canWrite]);
  useEffect(() => setEntries(initial), [initial]);

  function choose(id: string) {
    setSection(id);
    setShowAll(false);
    window.history.replaceState(null, "", id === FREE ? "/journal" : `/journal?area=${id}`);
    bodyRef.current?.focus({ preventScroll: true });
  }

  function reset() {
    setEditing(null);
    setExtras(false);
    setDate(today);
    setPrompt(null);
    setBody("");
    setGoalId("");
    setVideo("");
    setPictures([]);
    setUploaded([]);
  }

  async function cancel() {
    if (uploaded.length) await createClient().storage.from("journal").remove(uploaded);
    reset();
  }

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_IMAGES - pictures.length;
    if (room <= 0) return setStatus({ text: `Up to ${MAX_IMAGES} images per entry.`, error: true });
    setBusy(true);
    setStatus(null);
    const supabase = createClient();
    const added: Picture[] = [];
    for (const file of Array.from(files).slice(0, room)) {
      const small = await shrink(file);
      const blob = small ?? (IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES ? file : null);
      if (!blob) {
        setStatus({ text: "That image couldn’t be added. Try a JPEG, PNG or WebP under 5 MB.", error: true });
        continue;
      }
      const ext = small ? "jpg" : file.type.split("/")[1];
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("journal").upload(path, blob, { contentType: small ? "image/jpeg" : file.type });
      if (error) {
        setStatus({ text: "Couldn’t add that image just now — try again.", error: true });
        continue;
      }
      added.push({ path, url: URL.createObjectURL(blob) });
    }
    setPictures((list) => [...list, ...added]);
    setUploaded((list) => [...list, ...added.map((a) => a.path)]);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    const r = await saveJournalEntry({
      id: editing,
      entryDate: date,
      prompt,
      body,
      goalId: goalId || null,
      lifeAreaId: section === FREE ? null : section,
      videoUrl: video,
      images: pictures.map((p) => p.path),
    });
    setBusy(false);
    if (!r.ok) return setStatus({ text: r.message, error: true });
    const saved = r.entry!;
    setEntries((list) =>
      [saved, ...list.filter((e) => e.id !== saved.id)].sort((a, b) => (b.entry_date + b.created_at).localeCompare(a.entry_date + a.created_at))
    );
    setStatus({ text: editing ? "Updated privately." : "Saved privately." });
    reset();
  }

  async function remove(id: string) {
    setBusy(true);
    const r = await deleteJournalEntry(id);
    setBusy(false);
    setConfirm(null);
    if (!r.ok) return setStatus({ text: r.message, error: true });
    setEntries((list) => list.filter((e) => e.id !== id));
    if (editing === id) reset();
    setStatus({ text: "Entry deleted." });
  }

  async function download() {
    const r = await exportJournal();
    if (!r.ok) return setStatus({ text: r.message, error: true });
    const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aligned-journal-${today}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const goalTitle = new Map(goals.map((g) => [g.id, g.title]));
  const areaOf = new Map(areas.map((a) => [a.id, a]));
  const current = section === FREE ? null : areaOf.get(section) ?? null;
  const sectionName = current?.name ?? "Free writing";
  const count = (id: string) => entries.filter((e) => (e.life_area_id ?? FREE) === id).length;
  const shown = showAll ? entries : entries.filter((e) => (e.life_area_id ?? FREE) === section);
  const sections = [{ id: FREE, name: "Free writing", icon: "pen" as const }, ...areas.map((a) => ({ id: a.id, name: a.name, icon: AREA_ICONS[a.sort_order] ?? ("pen" as const) }))];

  return (
    <div className="alignment-stack">
      <section className="jr-sections" aria-labelledby="jr-sections-h">
        <h2 id="jr-sections-h" className="jr-k">{canWrite ? "Where do you want to write today?" : "Your sections"}</h2>
        <div className="jr-tiles" role="group" aria-label="Journal sections">
          {sections.map((x) => (
            <button key={x.id} type="button" className="jr-tile" aria-pressed={section === x.id} onClick={() => choose(x.id)}>
              <span className="jr-tile-icon"><Icon name={x.icon} size={18} /></span>
              <span className="jr-tile-name">{x.name}</span>
              <span className="jr-tile-count">{count(x.id) ? `${count(x.id)} ${count(x.id) === 1 ? "entry" : "entries"}` : ""}</span>
            </button>
          ))}
        </div>
      </section>

      {canWrite ? (
        <section className="jr-write" aria-labelledby="journal-write-h" id="write">
          <div className="jr-write-head">
            <div>
              <p className="jr-k">{editing ? "Editing an entry" : "New entry"}</p>
              <h2 id="journal-write-h" className="jr-write-h">{sectionName}</h2>
            </div>
            <label className="jr-date">
              <span className="sr-only">Date</span>
              <input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label="The day you're writing about" />
            </label>
          </div>
          {prompt ? <p className="jr-prompt">{prompt}</p> : null}
          <label className="sr-only" htmlFor="journal-body">Your entry</label>
          <textarea
            ref={bodyRef}
            className="jr-paper"
            id="journal-body"
            rows={10}
            maxLength={20000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={current ? `Write freely about ${current.name.split(" & ")[0].toLowerCase()}…` : "Write whatever is here today…"}
          />

          <button type="button" className="jr-extras-toggle" aria-expanded={extras} onClick={() => setExtras((x) => !x)}>
            {extras ? "Hide the extras" : "Add a prompt, a photo, a video link or your Next Step"}
          </button>
          {extras ? (
            <div className="jr-extras">
              <div className="au-chips" role="group" aria-label="Start from a prompt (optional)">
                {prompts.map((p) => (
                  <button key={p} type="button" aria-pressed={prompt === p} onClick={() => setPrompt(prompt === p ? null : p)}>{p}</button>
                ))}
              </div>
              <div className="journal-extras">
                {goals.length ? (
                  <div className="journal-row">
                    <label className="alignment-label" htmlFor="journal-goal">About a Next Step <span className="au-small">Optional</span></label>
                    <select className="alignment-field" id="journal-goal" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                      <option value="">Not linked</option>
                      {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                    </select>
                  </div>
                ) : null}
                <div className="journal-row">
                  <label className="alignment-label" htmlFor="journal-video">A video link <span className="au-small">Optional</span></label>
                  <input className="alignment-field" id="journal-video" type="url" inputMode="url" placeholder="https://" value={video} onChange={(e) => setVideo(e.target.value)} />
                </div>
              </div>
              <div className="journal-pictures">
                {pictures.map((p) => (
                  <figure key={p.path}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a private, short-lived link */}
                    <img src={p.url} alt="" />
                    <button type="button" aria-label="Remove this image" onClick={() => setPictures((list) => list.filter((x) => x.path !== p.path))}>×</button>
                  </figure>
                ))}
                {pictures.length < MAX_IMAGES ? (
                  <label className="journal-add-image">
                    <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => addImages(e.target.files)} disabled={busy} />
                    + Add {pictures.length ? "another image" : "images"} <span className="au-small">up to {MAX_IMAGES}</span>
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="alignment-form-footer">
            <p className="alignment-small"><b>Only you can see your journal. Your coach can&rsquo;t.</b></p>
            <div className="alignment-inline">
              {editing || uploaded.length ? <button type="button" className="btn btn-g" onClick={cancel} disabled={busy}>Cancel</button> : null}
              <button type="button" className="btn btn-p" disabled={busy || !body.trim()} onClick={save}>{busy ? "Saving…" : "Save privately"}</button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="alignment-card" aria-labelledby="journal-list-h">
        <div className="jr-list-head">
          <h2 id="journal-list-h">{showAll ? "All your entries" : sectionName}</h2>
          <button type="button" className="alignment-secondary" onClick={() => setShowAll((x) => !x)}>
            {showAll ? `Only ${sectionName}` : "Show every section"}
          </button>
        </div>
        {shown.length ? (
          byMonth(shown).map((g) => (
            <div key={g.month} className="journal-month">
              <h3>{monthName(g.month)}</h3>
              <ol className="journal-list">
                {g.entries.map((e) => (
                  <li key={e.id}>
                    <p className="journal-when">
                      {dateLabel(e.entry_date)}
                      {showAll ? <span className="jr-tag">{e.life_area_id ? areaOf.get(e.life_area_id)?.name ?? "A life area" : "Free writing"}</span> : null}
                    </p>
                    {e.goal_id && goalTitle.has(e.goal_id) ? <p className="journal-goal">About your Next Step: {goalTitle.get(e.goal_id)}</p> : null}
                    {e.prompt ? <p className="journal-prompt">{e.prompt}</p> : null}
                    <p className="journal-text">{e.body}</p>
                    {e.imageUrls?.length ? (
                      <div className="journal-pictures is-read">
                        {e.imageUrls.map((u, i) => (
                          <a key={u} href={u} target="_blank" rel="noopener noreferrer" aria-label={`Open image ${i + 1} of ${e.imageUrls!.length}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- a private, short-lived link */}
                            <img src={u} alt="" loading="lazy" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {e.video_url ? (
                      <a className="journal-video" href={e.video_url} target="_blank" rel="noopener noreferrer">
                        <span aria-hidden="true">▶</span> Watch on {videoSite(e.video_url)} <span className="au-small">opens in a new tab</span>
                      </a>
                    ) : null}
                    <div className="alignment-inline">
                      {canWrite ? (
                        <button
                          type="button"
                          className="alignment-secondary"
                          onClick={() => {
                            setEditing(e.id);
                            setSection(e.life_area_id && areaOf.has(e.life_area_id) ? e.life_area_id : FREE);
                            setExtras(!!(e.prompt || e.goal_id || e.video_url || e.images?.length));
                            setDate(e.entry_date);
                            setPrompt(e.prompt);
                            setBody(e.body);
                            setGoalId(e.goal_id ?? "");
                            setVideo(e.video_url ?? "");
                            setPictures((e.images ?? []).map((path, i) => ({ path, url: e.imageUrls?.[i] ?? "" })));
                            setUploaded([]);
                            document.getElementById("write")?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          Edit
                        </button>
                      ) : null}
                      {confirm === e.id ? (
                        <>
                          <span className="alignment-small">Delete this entry and its images? It can&rsquo;t be undone.</span>
                          <button type="button" className="alignment-secondary" onClick={() => setConfirm(null)}>Keep it</button>
                          <button type="button" className="alignment-secondary" disabled={busy} onClick={() => remove(e.id)}>Delete</button>
                        </>
                      ) : (
                        <button type="button" className="alignment-secondary" onClick={() => setConfirm(e.id)}>Delete</button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))
        ) : (
          <p className="alignment-empty">{showAll ? "No entries yet." : `Nothing in ${sectionName} yet.`} There&rsquo;s nothing to catch up on.</p>
        )}
        {entries.length ? <button type="button" className="btn btn-g" onClick={download}>Export my journal</button> : null}
      </section>
      {status ? <p className={`alignment-status${status.error ? " alignment-status-error" : ""}`} role={status.error ? "alert" : "status"}>{status.text}</p> : null}
    </div>
  );
}
