import { ImageResponse } from "next/og";

// The home-screen icon: the gold mark on the app's background, kept inside
// the middle of the square so phones can crop it to a circle or rounded square.
export function appIcon(px: number) {
  const mark = Math.round(px * 0.5);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#100F18" }}>
        <svg width={mark} height={Math.round((mark * 27) / 30)} viewBox="0 0 30 27" fill="none">
          <path d="M15 1 L29 25 L1 25 Z" stroke="#D3A758" strokeWidth="2.2" fill="none" />
          <circle cx="15" cy="18" r="3" fill="#D3A758" />
        </svg>
      </div>
    ),
    { width: px, height: px }
  );
}
