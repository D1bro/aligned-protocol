"use client";

import { useEffect, useState } from "react";

// The gold ring around a score. Animates in on mount — the ring sweeps from
// empty to the actual percentage and the number counts up alongside it —
// rather than just snapping to its final state. Respects prefers-reduced-motion
// (skips straight to the final state for anyone who's asked for less motion).
export function ScoreRing({
  score,
  size = 140,
  strokeWidth = 10,
  labelSize = 34,
  denomLabel = "/ 100",
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  labelSize?: number;
  denomLabel?: string;
}) {
  const pct = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const target = Math.round(score);

  const [filledPct, setFilledPct] = useState(0);
  const [displayNum, setDisplayNum] = useState(0);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setFilledPct(pct);
      setDisplayNum(target);
      return;
    }

    let raf: number;
    const duration = 900;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setFilledPct(eased * pct);
      setDisplayNum(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct, target]);

  const offset = circumference * (1 - filledPct / 100);

  return (
    <div className="ring-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--bg4)" strokeWidth={strokeWidth} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset .1s linear" }}
        />
      </svg>
      <div className="ring-inner">
        <div className="ring-num" style={{ fontSize: labelSize }}>{displayNum}</div>
        <div className="ring-den">{denomLabel}</div>
      </div>
    </div>
  );
}
