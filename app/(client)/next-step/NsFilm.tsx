import { GuideVideo } from "@/components/audit/GuideVideo";
import { filmOrSoon, type GuideClip } from "@/lib/audit-guides";

// Duane's films for The Next Step. None are recorded yet: each shows as a
// small "Film coming soon" row rather than a large empty player.
export const NEXT_STEP_FILMS = {
  why: filmOrSoon(null, "next-step-why", "Why your Next Step matters"),
  moves: filmOrSoon(null, "next-step-moves", "Making your Next Step believable"),
  set: filmOrSoon(null, "next-step-set", "What happens next"),
};

export function NsFilm({ clip, caption }: { clip: GuideClip; caption: string }) {
  if (clip.src) return <GuideVideo clip={clip} caption={caption} />;
  return (
    <div className="au-sum-card ns-film">
      <span className="ns-film-play" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </span>
      <div>
        <p className="ns-strong">{caption}</p>
        <p className="au-small">Film coming soon</p>
      </div>
    </div>
  );
}
