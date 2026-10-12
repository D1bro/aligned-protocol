import Link from "next/link";
import { redirect } from "next/navigation";
import { startOrResumeAudit, getAuditWithResponses, getLifeAreas } from "@/lib/actions/audit";
import { INTRO_GUIDE } from "@/lib/audit-guides";
import { BrandMark } from "@/components/ui/BrandMark";
import { GuideVideo } from "@/components/audit/GuideVideo";
import { LifeMap } from "@/components/audit/LifeMap";

// Demonstration values for the labelled example — never a real person's answers.
const EXAMPLE_SCORES = [8, 8, 8, 4, 8, 5, 8, 5, 6, 8];

// Entry point. Someone already mid-audit (or resuming/retaking) is sent
// straight back to their first unanswered area, same as before. Someone
// brand new — most guests, since this is now the front door for anyone
// without an account — sees a short intro first instead of being dropped
// straight into a wall of rating buttons with no context for what this is.
export default async function AuditEntryPage({ searchParams }: { searchParams: Promise<{ intro?: string }> }) {
  const { intro } = await searchParams;
  const auditId = await startOrResumeAudit();
  const [{ responses }, areas] = await Promise.all([getAuditWithResponses(auditId), getLifeAreas()]);

  const answeredIds = new Set(responses.map((r) => r.life_area_id));
  const firstUnanswered = areas.find((a) => !answeredIds.has(a.id));
  const resumeStep = firstUnanswered ? firstUnanswered.sort_order : areas.length; // all answered -> land on last

  // ?intro=1 is how Back from the first area returns here without being
  // bounced straight into the audit again.
  if (responses.length > 0 && intro !== "1") redirect(`/audit/${resumeStep}`);

  return (
    <div className="page au-page">
      <div className="au-hero">
        <div>
          <div className="au-brand">
            <BrandMark width={34} />
            <div>
              <div className="au-brand-name">ALIGNED</div>
              <div className="au-brand-sub">PROTOCOL</div>
            </div>
          </div>
          <div className="eyebrow"><span className="eydot" /> The Aligned audit</div>
          <h1 className="au-hero-h">
            Ten honest questions.
            <br />
            One clear starting point.
          </h1>
          <p className="lead">
            A guided look at ten areas of your life. Score how things are right now, add your notes, and see where to
            focus first.
          </p>
          <div className="au-hero-actions">
            {responses.length > 0 ? (
              <Link href={`/audit/${resumeStep}`} className="btn btn-p">Continue my audit →</Link>
            ) : (
              <Link href="/audit/1" className="btn btn-p">Begin my audit →</Link>
            )}
            <a href="#example" className="au-text-link">See an example snapshot</a>
          </div>
          <ol className="au-mini-steps">
            <li><b>01</b> Score ten areas</li>
            <li><b>02</b> Add your notes</li>
            <li><b>03</b> See your snapshot</li>
          </ol>
          <p className="au-small" style={{ marginTop: "1rem" }}>
            Free, and no account needed to start. Takes about 10 minutes.
          </p>
        </div>
        <GuideVideo clip={INTRO_GUIDE} caption="A guide from Duane: what you’re answering, how to score it, and the snapshot you’re working towards." />
      </div>

      <section id="example" className="au-example" aria-labelledby="au-example-h">
        <div className="au-example-copy">
          <span className="au-example-tag">Example</span>
          <h2 id="au-example-h">Your ten answers become a picture of where you stand.</h2>
          <p>
            This is a sample snapshot, not your results. Each numbered spoke is one area, scored from the centre out to 10
            at the edge. Yours is built from your own answers when you finish.
          </p>
        </div>
        <div className="au-example-map">
          <LifeMap
            scores={EXAMPLE_SCORES}
            names={areas.map((a) => a.name)}
            title="Example life map with sample scores"
          />
        </div>
      </section>
    </div>
  );
}
