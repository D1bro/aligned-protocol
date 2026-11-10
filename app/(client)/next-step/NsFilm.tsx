import { GuideVideo } from "@/components/audit/GuideVideo";
import { filmOrSoon, type GuideClip } from "@/lib/audit-guides";

// Duane's films for The Next Step, one per screen and one for the set page.
// None are recorded yet: each shows as a plain placeholder the size of the
// film, so the page already has its space (Duane, 10 Nov 2026).
export const NEXT_STEP_FILMS = {
  here: filmOrSoon(null, "next-step-here", "Where you are"),
  ten: filmOrSoon(null, "next-step-ten", "Your destination"),
  step: filmOrSoon(null, "next-step-step", "Your Next Step"),
  way: filmOrSoon(null, "next-step-way", "What’s in the way"),
  moves: filmOrSoon(null, "next-step-moves", "Your route"),
  set: filmOrSoon(null, "next-step-set", "What happens next"),
};

export function NsFilm({ clip, caption }: { clip: GuideClip; caption: string }) {
  if (clip.src) return <GuideVideo clip={clip} caption={caption} />;
  return (
    <figure className="ns-film">
      <div className="ns-film-box">
        <span className="ns-film-play" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </span>
        <span className="ns-film-k">Film coming soon</span>
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
