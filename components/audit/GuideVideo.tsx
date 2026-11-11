"use client";

import type { GuideClip } from "@/lib/audit-guides";
import { useFilmSource } from "@/components/films/FilmLinks";

// A video slot for Duane's guidance (media comes from lib/audit-guides.ts,
// or a link pasted in Console → Films). Never autoplays; controls stay
// visible so people can pause or replay. preload="none" means nothing
// downloads until someone presses play. Captions are a separate English
// track, switchable with the CC control. A film that isn't there yet shows
// nothing at all (Duane, 11 Nov 2026: no "coming soon" on the site).
export function GuideVideo({ clip, caption, className }: { clip: GuideClip; caption?: React.ReactNode; className?: string }) {
  const source = useFilmSource(clip);
  if (!source) return null;
  return (
    <figure className={className ? `au-video ${className}` : "au-video"}>
      <div className="au-video-frame">
        {source.kind === "embed" ? (
          <iframe
            src={source.src}
            title={`${clip.title}: video from Duane`}
            loading="lazy"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="au-video-embed"
          />
        ) : (
          <video
            src={source.src}
            poster={clip.poster ?? undefined}
            controls
            preload="none"
            playsInline
            aria-label={`${clip.title} — video from Duane`}
          >
            {clip.src && clip.captions ? <track kind="captions" src={clip.captions} srcLang="en" label="English" /> : null}
          </video>
        )}
      </div>
      {caption ? <figcaption className="au-video-caption">{caption}</figcaption> : null}
    </figure>
  );
}
