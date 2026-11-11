"use client";

import type { GuideClip } from "@/lib/audit-guides";
import { GuideVideo } from "@/components/audit/GuideVideo";
import { useFilmSource } from "@/components/films/FilmLinks";

// A film position from FILMS (lib/audit-guides.ts). Until the film exists
// (a file, or a link in Console → Films), the page shows its text fallback
// instead, so there's never an empty or broken player.
export function Film({ clip, caption, children }: { clip: GuideClip | null; caption?: string; children: React.ReactNode }) {
  const source = useFilmSource(clip);
  if (clip && source) return <GuideVideo clip={clip} caption={caption} />;
  return <>{children}</>;
}
