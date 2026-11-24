"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { previewFollowupCopy, resetFollowupCopy, saveFollowupCopy } from "@/lib/actions/followups";
import { areaNamed, copyProblem, followupEmail, type CopyKey, type FollowupCopy, type FollowupDay } from "@/lib/followup-content";
import { renderEmail } from "@/lib/email-layout";

const same = (a: FollowupCopy, b: FollowupCopy) => a.subject.trim() === b.subject.trim() && a.preheader.trim() === b.preheader.trim() && a.body.trim() === b.body.trim() && a.button.trim() === b.button.trim();
const SAMPLE_LINKS = { nextStep: "#", checkIn: "#", coaching: "#", stop: "#" };

// One of the eight emails: its words, a live preview as Sam (score 45),
// and Save / Send me this one / Back to the original.
export function FollowupEditor({
  copyKey,
  label,
  buttonGoesTo,
  original,
  saved,
  savedAt,
  disabled,
}: {
  copyKey: CopyKey;
  label: string;
  buttonGoesTo: string;
  original: FollowupCopy;
  saved: FollowupCopy | null;
  savedAt: string | null;
  disabled: boolean;
}) {
  const router = useRouter();
  const current = saved ?? original;
  const [c, setC] = useState<FollowupCopy>(current);
  const [busy, setBusy] = useState<"save" | "send" | "reset" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const problem = copyProblem(c);
  const area = areaNamed(c);
  const changed = !same(c, current);
  const id = `fu-${copyKey}`;

  const html = useMemo(() => {
    const [day, kind] = copyKey.split("-");
    const m = followupEmail({ day: Number(day) as FollowupDay, hasStep: kind === "set", firstName: "Sam", score: 45, links: SAMPLE_LINKS, copy: problem ? current : c });
    return renderEmail({ preheader: m.preheader, heading: m.heading, blocks: m.blocks, signature: m.signature });
  }, [c, copyKey, current, problem]);
  const [day, kind] = copyKey.split("-");
  const subjectPreview = followupEmail({ day: Number(day) as FollowupDay, hasStep: kind === "set", firstName: "Sam", score: 45, links: SAMPLE_LINKS, copy: problem ? current : c }).subject;

  async function run(what: "save" | "send" | "reset") {
    setBusy(what);
    setMsg(null);
    const r = await (what === "save" ? saveFollowupCopy(copyKey, c) : what === "send" ? previewFollowupCopy(copyKey, c) : resetFollowupCopy(copyKey)).catch(() => ({
      ok: false as const,
      message: "Couldn’t reach the site. Try again.",
    }));
    setBusy(null);
    setMsg({ ok: r.ok, text: r.message ?? "Done." });
    if (r.ok && what === "reset") setC(original);
    if (r.ok && what !== "send") router.refresh();
  }

  const set = (k: keyof FollowupCopy) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setC({ ...c, [k]: e.target.value });
    setMsg(null);
  };

  return (
    <article className="admin-card fu-email" aria-labelledby={`${id}-h`}>
      <header className="fu-email-head">
        <h3 id={`${id}-h`}>{label}</h3>
        <span className={saved ? "fu-tag is-edited" : "fu-tag"}>{saved ? `Your wording · saved ${savedAt}` : "Original wording"}</span>
      </header>
      <p className="fu-subject"><b>{subjectPreview}</b></p>
      <button type="button" className="auth-link fu-toggle" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen(!open)}>
        {open ? "Close" : "Edit and preview"}
      </button>

      {open ? (
        <div id={`${id}-body`} className="fu-email-body">
          <div className="fu-fields">
            <label>
              <span>Subject</span>
              <input value={c.subject} maxLength={120} onChange={set("subject")} disabled={disabled} />
            </label>
            <label>
              <span>Preview line <small>(the grey text inboxes show after the subject)</small></span>
              <input value={c.preheader} maxLength={160} onChange={set("preheader")} disabled={disabled} />
            </label>
            <label>
              <span>Email <small>(after &ldquo;Hi [first name],&rdquo;; a blank line between paragraphs; signed &ldquo;Duane&rdquo;)</small></span>
              <textarea value={c.body} rows={12} onChange={set("body")} disabled={disabled} />
            </label>
            <label>
              <span>Button <small>(goes to {buttonGoesTo})</small></span>
              <input value={c.button} maxLength={40} onChange={set("button")} disabled={disabled} />
            </label>
            {problem ? <p className="clear-err" role="alert">{problem}</p> : null}
            {area && !problem ? (
              <p className="fu-warn" role="status">
                This names &ldquo;{area}&rdquo;. These emails go to everyone, so they shouldn&rsquo;t point at the area someone chose. Fine if you mean it
                generally.
              </p>
            ) : null}
            <div className="fu-actions">
              <button type="button" className="btn btn-g" disabled={disabled || !changed || !!problem || busy !== null} onClick={() => run("save")}>
                {busy === "save" ? "Saving…" : "Save"}
              </button>
              <button type="button" className="btn btn-o" disabled={disabled || !!problem || busy !== null} onClick={() => run("send")}>
                {busy === "send" ? "Sending…" : "Send me this one"}
              </button>
              {saved ? (
                <button type="button" className="auth-link" disabled={busy !== null} onClick={() => run("reset")}>
                  {busy === "reset" ? "Restoring…" : "Back to the original"}
                </button>
              ) : null}
              {changed && !msg ? <span className="admin-card-sub">Not saved yet</span> : null}
              {msg ? <span className={msg.ok ? "admin-ok" : "clear-err"} role="status">{msg.text}</span> : null}
            </div>
          </div>
          <div className="fu-preview">
            <span className="admin-card-sub">Preview, as Sam with a score of 45</span>
            <iframe title={`Preview: ${label}`} srcDoc={html} sandbox="" />
          </div>
        </div>
      ) : null}
    </article>
  );
}
