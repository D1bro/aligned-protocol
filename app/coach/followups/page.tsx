import { requireAdmin } from "@/lib/actions/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCopy, loadPauses, loadSequence } from "@/lib/followups";
import { COPY_KEYS, COPY_LABEL, BUTTON_GOES_TO, BUTTON_PLACE, DEFAULT_COPY } from "@/lib/followup-content";
import { formatDate } from "@/lib/audit-schedule";
import { FollowupEditor } from "./FollowupEditor";
import { PauseSwitch } from "./PauseSwitch";
import { SequenceTable, statusOf } from "./SequenceTable";

export const dynamic = "force-dynamic";

// Console → Follow-up emails (Duane, 24 Nov 2026): everyone in the sequence
// and where they are, the wording of all eight emails, and a pause switch.
export default async function FollowupsPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const pauses = await loadPauses(admin);
  const [{ installed, copy }, seq] = await Promise.all([loadCopy(admin), loadSequence(admin, new Date(), pauses)]);
  const people = seq.ok ? seq.people : [];
  const rows = people.map((p) => ({ p, s: statusOf(p) })).sort((a, b) => (b.p.start ?? "").localeCompare(a.p.start ?? ""));
  const count = (tone: string) => rows.filter((r) => r.s.tone === tone).length;

  return (
    <div className="page admin-page">
      <div className="eyebrow"><span className="eydot" /> Follow-up emails</div>
      <h1>Follow-up emails after the audit</h1>
      <p className="lead">
        Four emails from you at 9:21am UK time, on days 1, 3, 7 and 10 after someone&rsquo;s first audit, only to people who ticked the box
        when they made their account. Each email has two versions, for people who have or haven&rsquo;t set their Next Step yet.
      </p>

      {!installed ? <p className="clear-err">This page needs database update 0038 before you can save wording or pause.</p> : null}

      <PauseSwitch paused={pauses.paused} since={pauses.since ? formatDate(pauses.since) : null} disabled={!installed} />

      <h2 className="sec-head" id="fu-who">Who&rsquo;s in the sequence</h2>
      {!seq.ok ? (
        <p className="clear-err">Couldn&rsquo;t load the sequence. Has database update 0037 been run?</p>
      ) : !rows.length ? (
        <p className="admin-card-sub">Nobody yet. People appear here once they tick &ldquo;Send me a few short emails from Duane&rdquo; when they make their account.</p>
      ) : (
        <>
          <p className="admin-card-sub">
            {count("on")} in progress · {count("wait")} waiting for their audit · {count("done")} finished · {count("off")} stopped.
            Dates ahead assume nothing is paused. Hover &ldquo;Skipped&rdquo; or &ldquo;Failed&rdquo; for the reason.
          </p>
          <SequenceTable rows={rows} />
        </>
      )}

      <h2 className="sec-head">The emails</h2>
      <p className="admin-card-sub">
        Edit any of the eight. Paragraphs are separated by a blank line. [first name] and [score] are filled in for each person; a sentence
        with [score] is left out if there&rsquo;s no score. Never name the area someone chose or quote their Next Step. Changes go out from the
        next 9:21 send; anything already sent stays as it was.
      </p>
      <div className="fu-emails">
        {COPY_KEYS.map((key) => {
          const saved = copy[key];
          return (
            <FollowupEditor
              key={key}
              copyKey={key}
              label={COPY_LABEL[key]}
              buttonGoesTo={BUTTON_PLACE[BUTTON_GOES_TO[key]]}
              original={DEFAULT_COPY[key]}
              saved={saved ? { subject: saved.subject, preheader: saved.preheader, body: saved.body, button: saved.button } : null}
              savedAt={saved ? formatDate(saved.updatedAt) : null}
              disabled={!installed}
            />
          );
        })}
      </div>
    </div>
  );
}
