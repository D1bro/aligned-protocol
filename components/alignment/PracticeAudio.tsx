"use client";

import { useRef, useState } from "react";
import type { GuideAudioClip } from "@/lib/audit-guides";
import { useFilmSource } from "@/components/films/FilmLinks";

// The daily practice's audio: one large play button, progress and time.
// Never autoplays, and nothing downloads until play is pressed. onFinish runs
// when it plays to the end, so the page can tick "I took a moment to arrive".
const clock = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "–:––");

export function PracticeAudio({ clip, onFinish, quiet = false }: { clip: GuideAudioClip; onFinish?: () => void; quiet?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(NaN);
  // Its own file, or the link pasted for its slot in Console → Films.
  const source = useFilmSource(clip);
  const src = source?.kind === "file" ? source.src : null;
  const share = Number.isFinite(length) && length > 0 ? Math.min(100, (at / length) * 100) : 0;

  function toggle() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  }

  // Not recorded yet: nothing in its place (Duane, 11 Nov 2026).
  if (!src) return null;

  return (
    <div className={`pa${quiet ? " pa-quiet" : ""}`}>
      <button type="button" className="pa-play" onClick={toggle} aria-label={`${playing ? "Pause" : "Play"} ${clip.title}`}>
        {playing ? (
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
        )}
      </button>
      <div className="pa-body">
        <div className="pa-top">
          <p className="pa-title">{clip.title} <span>· with Duane</span></p>
          <p className="pa-time">{`${clock(at)} / ${clock(length)}`}</p>
        </div>
        <div className="pa-bar" aria-hidden="true"><span style={{ width: `${share}%` }} /></div>
      </div>
      {src ? (
        <audio
          ref={audio}
          src={src}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(e) => setLength(e.currentTarget.duration)}
          onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
          onEnded={() => { setPlaying(false); onFinish?.(); }}
        />
      ) : null}
    </div>
  );
}
