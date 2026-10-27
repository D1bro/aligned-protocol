import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { MOMENTUM_HOUR, OFFERS, joinHref } from "@/lib/offers";

export const metadata: Metadata = {
  title: "Support options",
  description: "Aligned Clarity is free. Add a daily practice, a live weekly hour with a small group, or six weeks with an Aligned Coach.",
};

// The four offers, at founding prices. Public: linked from Your plan is set
// and My profile, and readable before anyone has an account.
export default function OffersPage() {
  return (
    <div className="site">
      <SiteHeader cta={{ href: "/audit", label: "Take the free audit" }} />
      <main className="of-page">
        <div className="home-in">
          <div className="of-head">
            <div className="eyebrow"><span className="eydot" /> Support options</div>
            <h1>Your plan works on its own. Choose how much support you&rsquo;d like with it.</h1>
            <p>
              Add a daily practice, a weekly appointment with others, or six weeks with a coach. Everything you&rsquo;ve
              built stays with you, whichever you choose.
            </p>
          </div>

          <p className="of-banner">
            <span className="of-pill">Founding prices</span>
            For our first members. Keep your founding monthly price for as long as your membership stays active.
          </p>

          <div className="of-grid">
            {OFFERS.map((o) => (
              <section key={o.key} className={o.featured ? "of-card is-featured" : "of-card"} aria-labelledby={`of-${o.key}`}>
                <div>
                  <h2 id={`of-${o.key}`}>
                    {o.name}
                    {o.pilot ? <span className="of-pill">Pilot</span> : null}
                  </h2>
                  <p className="of-tag">{o.tagline}</p>
                </div>
                <div>
                  <p className="of-price">{o.price}{o.per ? <span> {o.per}</span> : null}</p>
                  <p className="of-note">{o.priceNote}</p>
                </div>
                {o.intro ? <p className="of-intro">{o.intro}</p> : null}
                <ul>{o.includes.map((line) => <li key={line}>{line}</li>)}</ul>
                {o.key === "momentum" ? (
                  <div className="of-hour">
                    <p className="of-note">The hour</p>
                    <div className="of-hour-bar" aria-hidden="true">
                      {MOMENTUM_HOUR.map(([label, mins]) => <span key={label} style={{ flex: mins }} />)}
                    </div>
                    <p className="of-note">{MOMENTUM_HOUR.map(([label, mins]) => `${label} ${mins}`).join(" · ")}</p>
                  </div>
                ) : null}
                {o.key === "clarity" ? (
                  <Link href="/audit" className="btn btn-g">Start free</Link>
                ) : (
                  <a href={joinHref(o)} className={o.featured ? "btn btn-p" : "btn btn-g"}>
                    {o.key === "focus" ? "Ask to start Focus" : "Join the founding list"}
                  </a>
                )}
              </section>
            ))}
          </div>

          <div className="of-facts">
            <div>
              <h3>One account throughout</h3>
              <p>Change your support at any time. Your plan, reviews and history always come with you.</p>
            </div>
            <div>
              <h3>Cancel whenever you like</h3>
              <p>Memberships run month to month. If you cancel, you go back to Clarity at the end of the month, and nothing you&rsquo;ve written is deleted.</p>
            </div>
            <div>
              <h3>Focus doesn&rsquo;t roll over</h3>
              <p>After six weeks there&rsquo;s no automatic membership. Already a member? You keep your founding rate, with credit for the weeks Focus covers.</p>
            </div>
          </div>

          <p className="of-small">Prices shown are the total you pay. Coaching and the live sessions aren&rsquo;t therapy.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
