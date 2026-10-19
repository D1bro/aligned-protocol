import Link from "next/link";
import { PROFILE_OFFER } from "@/lib/site-copy";

// "Keep your starting point. Build your next step." — the same words on the
// homepage, the results page and the registration page.
export function ProfileOffer({
  href = "/login?signup=1",
  signInHref = "/login",
  showButton = true,
  headingLevel = 2,
}: {
  href?: string;
  signInHref?: string | null;
  showButton?: boolean;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="profile-offer">
      <H className="profile-offer-h">{PROFILE_OFFER.heading}</H>
      <ul className="profile-offer-list">
        {PROFILE_OFFER.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {showButton ? (
        <div className="profile-offer-actions">
          <Link href={href} className="btn btn-p">{PROFILE_OFFER.button}</Link>
          {signInHref ? (
            <span className="profile-offer-signin">
              Already have a profile? <Link href={signInHref}>Sign in</Link>
            </span>
          ) : null}
        </div>
      ) : null}
      <p className="profile-offer-next">{PROFILE_OFFER.next}</p>
    </div>
  );
}
