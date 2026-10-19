import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLifeAreas, getInProgressAudit, getLatestCompletedAudit } from "@/lib/actions/audit";
import { AREA_SHORT_NAMES, FILMS } from "@/lib/audit-guides";
import { MUSINGS, PATHS } from "@/lib/learn-content";
import { ABOUT_DUANE, AFTER_REGISTERING, EXAMPLE, FAQS, HERO, HOW, SITE } from "@/lib/site-copy";
import { LifeMap } from "@/components/audit/LifeMap";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ProfileOffer } from "@/components/site/ProfileOffer";
import { Film } from "@/components/site/Film";

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
            <div>
              <div className="eyebrow"><span className="eydot" /> About Duane</div>
              <h2 id="about-h">{ABOUT_DUANE.heading}</h2>
              {ABOUT_DUANE.approved ? null : <span className="draft-tag">Draft · awaiting approved copy</span>}
              {ABOUT_DUANE.paragraphs.map((p) => (
                <p key={p} className="home-lead">{p}</p>
              ))}
            </div>
            <Film clip={FILMS.F01} caption="A welcome from Duane.">
              <figure className="home-film-fallback">
                <p>
                  Duane guides you through the audit itself: each of the ten areas has a short film explaining what
                  you&rsquo;re scoring.
                </p>
                <Link href="/audit" className="au-text-link">Start with the introduction</Link>
              </figure>
            </Film>
          </div>
        </section>

        {/* 5. Free profile */}
        <section className="home-sec home-alt" aria-labelledby="offer-h">
          <div className="home-in home-offer">
            <div>
              <div className="eyebrow"><span className="eydot" /> Your free profile</div>
              <ProfileOffer href={cta.href === "/audit/results" ? "/login?signup=1" : "/audit"} />
              <p className="home-small">You&rsquo;ll see your snapshot first, before you decide.</p>
            </div>
            <div className="home-after">
              <h3>What happens after you register</h3>
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
            <h2 id="explore-h">The ten areas the audit looks at</h2>
            <ul className="home-areas">
              {areas.map((a) => (
                <li key={a.id}>
                  <b>{a.name}</b>
                  <span>{a.description}</span>
                </li>
              ))}
            </ul>
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

      <footer className="site-foot">
        <div className="home-in site-foot-in">
          <span>Alignment is the foundation. Action is the transformation.</span>
          <span>
            Aligned Media · <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> · <Link href="/login">Sign in</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
