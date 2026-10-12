import type { GuideClip } from "@/lib/audit-guides";

// A video slot for Duane's guidance (media comes from lib/audit-guides.ts).
// Never autoplays; controls stay visible so people can pause or replay.
// preload="none" means nothing downloads until someone presses play.
export function GuideVideo({ clip, caption }: { clip: GuideClip; caption?: string }) {
  return (
    <figure className="au-video">
      <div className="au-video-frame">
        {clip.src ? (
          <video
            src={clip.src}
            poster={clip.poster ?? undefined}
            controls
            preload="none"
            playsInline
            aria-label={`${clip.title} — video from Duane`}
          >
            {clip.captions ? <track kind="captions" src={clip.captions} srcLang="en" label="English" /> : null}
          </video>
        ) : (
          <>
            {clip.poster ? (
              // Decorative still; the label below names the video.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clip.poster} alt="" className="au-video-poster" />
            ) : null}
            <div className="au-video-soon">
              <span className="au-play" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16"><path d="M5 3.5v9l7.5-4.5z" fill="currentColor" /></svg>
              </span>
              <span>Video coming soon</span>
            </div>
            <div className="au-video-label">{clip.label}</div>
          </>
        )}
      </div>
      {caption ? <figcaption className="au-video-caption">{caption}</figcaption> : null}
    </figure>
  );
}
