import type { GuideAudioClip } from "@/lib/audit-guides";

// A slot for Duane's audio guidance (lib/audit-guides.ts AUDIO). Never
// autoplays; nothing downloads until someone presses play.
export function GuideAudio({ clip, caption }: { clip: GuideAudioClip; caption?: string }) {
  return (
    <figure className="guide-audio">
      <div className="guide-audio-head">
        <span className="au-play" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 6v4h2.5L9 13V3L5.5 6zm8.2-1.2a4.5 4.5 0 0 1 0 6.4M10 6.5a2 2 0 0 1 0 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div>
          <p className="guide-audio-title">{clip.title}</p>
          <p className="guide-audio-label">{clip.src ? clip.label : `${clip.label} · audio coming soon`}</p>
        </div>
      </div>
      {clip.src ? <audio src={clip.src} controls preload="none" aria-label={`${clip.title} — audio from Duane`} /> : null}
      {caption ? <figcaption className="guide-audio-caption">{caption}</figcaption> : null}
    </figure>
  );
}
