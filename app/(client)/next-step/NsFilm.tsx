import { GuideVideo } from "@/components/audit/GuideVideo";
import { filmOrSoon, type GuideClip } from "@/lib/audit-guides";

// Duane's films for The Next Step, one per screen and one for the set page.
// Each is a slot in Console → Films (lib/films.ts), by these ids.
export const NEXT_STEP_FILMS = {
  here: filmOrSoon(null, "next-step-here", "Where you are"),
  ten: filmOrSoon(null, "next-step-ten", "Your destination"),
  step: filmOrSoon(null, "next-step-step", "Your Next Step"),
  way: filmOrSoon(null, "next-step-way", "What’s in the way"),
  moves: filmOrSoon(null, "next-step-moves", "Your route"),
  set: filmOrSoon(null, "next-step-set", "What happens next"),
};

// Shows nothing until the film exists (a link in Console → Films).
export function NsFilm({ clip, caption }: { clip: GuideClip; caption: string }) {
  return <GuideVideo clip={clip} caption={caption} />;
}
