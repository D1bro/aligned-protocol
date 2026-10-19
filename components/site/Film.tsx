import type { GuideClip } from "@/lib/audit-guides";
import { GuideVideo } from "@/components/audit/GuideVideo";

// A film position from FILMS (lib/audit-guides.ts). Until the film exists,
// or where video isn't hosted, the page shows its text fallback instead, so
// there's never an empty or broken player.
export function Film({ clip, caption, children }: { clip: GuideClip | null; caption?: string; children: React.ReactNode }) {
  if (clip?.src) return <GuideVideo clip={clip} caption={caption} />;
  return <>{children}</>;
}
