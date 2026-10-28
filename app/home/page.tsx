import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getLifeAreas, getInProgressAudit, getLatestCompletedAudit } from "@/lib/actions/audit";
import { AREA_SHORT_NAMES, FILMS } from "@/lib/audit-guides";
import { MUSINGS, PATHS } from "@/lib/learn-content";
import { ABOUT_DUANE, AFTER_REGISTERING, EXAMPLE, FAQS, HERO, HOW, SITE, WHO_SEES } from "@/lib/site-copy";
import { LifeMap } from "@/components/audit/LifeMap";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ProfileOffer } from "@/components/site/ProfileOffer";
import { Film } from "@/components/site/Film";
import { SiteFooter } from "@/components/site/SiteFooter";

// The public homepage. Visitors without a profile (including guests part-way
// through the audit) see it at "/" — middleware shows this page there — while
// signed-in members keep landing on My profile.
export const metadata: Metadata = {
  title: { absolute: SITE.title },
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: SITE.title,
    description: SITE.description,
    url: "/",
    siteName: SITE.name,
    type: "website",
    locale: "en_GB",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE.title }],
  },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description, images: ["/opengraph-image"] },
};

// Where the main button goes: a guest part-way through continues, a guest who
// has finished sees their snapshot, everyone else starts the audit.
async function auditAction(): Promise<{ href: string; label: string; returning: boolean }> {
  const fresh = { href: "/audit", label: "Take the free audit", returning: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.is_anonymous) return fresh;
  const [inProgress, latest] = await Promise.all([getInProgressAudit(), getLatestCompletedAudit()]);
  if (inProgress?.responses.length) return { href: "/audit", label: "Continue my audit", returning: true };
  if (latest) return { href: "/audit/results", label: "See my snapshot", returning: true };
  return fresh;
}

const isLive = process.env.VERCEL_ENV === "production";

export default async function HomePage() {
  const [areas, cta] = await Promise.all([getLifeAreas(), auditAction()]);
  const focusArea = areas[EXAMPLE.focusIndex];
  const published = {
    lessons: PATHS.flatMap((p) => p.lessons.filter((l) => !l.draft).map((l) => ({ ...l, path: p.slug }))),
    musings: MUSINGS.filter((m) => !m.draft),
  };

  return (
    <div className="site">
      <a href="#main" className="skip-link">Skip to content</a>
      <SiteHeader cta={{ href: cta.href, label: cta.returning ? cta.label : "Take the free audit" }} />

      <main id="main">
        {/* 1. Promise */}
        <section className="home-hero" aria-labelledby="home-h">
          <div className="home-in home-hero-grid">
            <div>
              <h1 id="home-h">
                {HERO.promise}
                <span>{HERO.promiseTail}</span>
              </h1>
              <p className="home-audience">{HERO.audience}</p>
              <div className="home-cta">
                <Link href={cta.href} className="btn btn-p">{cta.label} →</Link>
                <a href="#example" className="au-text-link">See an example</a>
              </div>
              <p className="home-support">{HERO.support}</p>
              <p className="home-small">{HERO.small}</p>
            </div>
            <figure className="home-hero-map">
              <LifeMap
                scores={EXAMPLE.scores}
                names={areas.map((a) => a.name)}
                labels={areas.map((a) => AREA_SHORT_NAMES[a.sort_order] ?? a.name)}
                highlightIndex={EXAMPLE.focusIndex}
                title="Fictional example life map"
              />
              <figcaption>Fictional example</figcaption>
            </figure>
          </div>
        </section>

        {/* 2. Fictional worked example */}
        <section id="example" className="home-sec" aria-labelledby="example-h">
          <div className="home-in">
            <span className="home-tag">Fictional example</span>
            <h2 id="example-h">From a snapshot to one practical action</h2>
            <p className="home-lead">
              An invented example to show how it works. It isn&rsquo;t a real person&rsquo;s result, and it isn&rsquo;t yours.
            </p>
            <ol className="home-flow">
              <li>
                <span className="home-flow-k">The snapshot</span>
                <b>{focusArea?.name ?? "Daily Structure & Discipline"}</b>
                <span className="home-score">{EXAMPLE.focusScore}/10</span>
              </li>
              <li>
                <span className="home-flow-k">One point better</span>
                <b>&ldquo;{EXAMPLE.stepUp}&rdquo;</b>
              </li>
              <li>
                <span className="home-flow-k">The action</span>
                <b>{EXAMPLE.action}</b>
              </li>
              <li>
                <span className="home-flow-k">The review</span>
                <b>{EXAMPLE.review}</b>
              </li>
            </ol>
          </div>
        </section>

        {/* 3. How it works */}
        <section id="how" className="home-sec home-alt" aria-labelledby="how-h">
          <div className="home-in">
            <div className="eyebrow"><span className="eydot" /> How it works</div>
            <h2 id="how-h">Four steps, at your own pace</h2>
            <ol className="home-steps">
              {HOW.map((s, i) => (
                <li key={s.title}>
                  <span className="home-step-n">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
            <div className="home-cta">
              <Link href={cta.href} className="btn btn-p">{cta.label} →</Link>
            </div>
          </div>
        </section>

        {/* 4. Duane */}
        <section id="about" className="home-sec" aria-labelledby="about-h">
          <div className="home-in home-about">
            <Film clip={FILMS.F01} caption="A welcome from Duane.">
              <figure className="home-portrait">
                <Image
                  src={ABOUT_DUANE.photo.src}
                  width={ABOUT_DUANE.photo.width}
                  height={ABOUT_DUANE.photo.height}
                  alt={ABOUT_DUANE.photo.alt}
                  sizes="(max-width: 900px) 90vw, 440px"
                />
              </figure>
            </Film>
            <div>
              <div className="eyebrow"><span className="eydot" /> About Duane</div>
              <h2 id="about-h">{ABOUT_DUANE.heading}</h2>
              {/* Until Duane approves the wording, previews show it marked as a
                  draft; the live site leaves the text out. */}
              {ABOUT_DUANE.approved || !isLive
                ? <>
                    {ABOUT_DUANE.approved ? null : <span className="draft-tag">Draft · awaiting approval</span>}
                    {ABOUT_DUANE.paragraphs.map((p) => (
                      <p key={p} className="home-lead">{p}</p>
                    ))}
                  </>
                : null}
              <p className="home-small home-about-films">
                Duane also guides you through the audit itself: each of the ten areas has a short film.
              </p>
              {ABOUT_DUANE.approved || !isLive ? (
                <details className="home-story">
                  <summary>Read Duane&rsquo;s story</summary>
                  {ABOUT_DUANE.story.map((p) => <p key={p}>{p}</p>)}
                </details>
              ) : null}
            </div>
          </div>
        </section>

        {/* 5. Free profile */}
        <section className="home-sec home-alt" aria-labelledby="offer-h">
          <div className="home-in home-offer">
            <div>
              <div className="eyebrow"><span className="eydot" /> Your free profile</div>
              <ProfileOffer href={cta.href === "/audit/results" ? "/audit/results#step-up" : "/audit"} />
              <p className="home-small">You&rsquo;ll see your snapshot and build your plan first, before you decide.</p>
            </div>
            <div className="home-after">
              <h3>How it works</h3>
              <ol>
                {AFTER_REGISTERING.map((s) => <li key={s}>{s}</li>)}
              </ol>
            </div>
          </div>
        </section>

        {/* 6. Explore: the ten areas, plus learning once published */}
        <section id="explore" className="home-sec" aria-labelledby="explore-h">
          <div className="home-in">
            <div className="eyebrow"><span className="eydot" /> Explore</div>
            <div className="home-areas-head">
              <div>
                <h2 id="explore-h">The ten areas the audit looks at</h2>
                <p className="home-lead">You score each one from 1 to 10. Together they show where your life feels aligned, and where one small change would matter most.</p>
              </div>
              <div className="home-scale">
                <span className="home-scale-bar" aria-hidden="true" />
                <p><span>1 · out of alignment</span><span>10 · fully aligned</span></p>
              </div>
            </div>
            <ol className="home-areas">
              {areas.map((a, i) => (
                <li key={a.id}>
                  <span className="home-area-n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{a.name}</h3>
                    <p>{a.description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="home-areas-cta">
              <Link href={cta.href} className="btn btn-p">{cta.returning ? cta.label : "Take the free audit"}</Link>
              {cta.returning ? null : <span>Free, and no account needed to start.</span>}
            </p>
            {published.lessons.length || published.musings.length ? (
              <ul className="learn-cards home-learn">
                {published.lessons.map((l) => (
                  <li key={l.slug}>
                    <Link href={`/learn/${l.path}/${l.slug}`}><b>{l.title}</b><em>Academy →</em></Link>
                  </li>
                ))}
                {published.musings.map((m) => (
                  <li key={m.slug}>
                    <Link href={`/musings/${m.slug}`}><b>{m.title}</b><span>{m.summary}</span><em>Read →</em></Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>

        {/* 7. FAQs and final invitation */}
        <section className="home-sec home-alt" aria-labelledby="faq-h">
          <div className="home-in home-faq">
            <h2 id="faq-h">Questions</h2>
            {FAQS.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
                {f.whoSees ? (
                  <div className="who-sees">
                    <div>
                      <h3>Your coach can see</h3>
                      <ul>{WHO_SEES.coach.map((x) => <li key={x}>{x}</li>)}</ul>
                      <p className="who-sees-foot">Only if you work with an Aligned Coach.</p>
                    </div>
                    <div className="is-private">
                      <h3>
                        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="9" width="12" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
                        Only you can see
                      </h3>
                      <ul>{WHO_SEES.you.map((x) => <li key={x}>{x}</li>)}</ul>
                      <p className="who-sees-foot">Not your coach, not our team. You can export or delete them yourself.</p>
                    </div>
                  </div>
                ) : null}
              </details>
            ))}
          </div>
        </section>

        <section className="home-final" aria-labelledby="final-h">
          <div className="home-in">
            <h2 id="final-h">{HERO.support}</h2>
            <p className="home-lead">{HERO.small}</p>
            <Link href={cta.href} className="btn btn-p">{cta.label} →</Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
