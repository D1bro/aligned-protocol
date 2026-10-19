import { ImageResponse } from "next/og";
import { HERO } from "@/lib/site-copy";

// The preview card shown when a link to the site is shared.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Aligned — see where you stand and choose what matters next";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", background: "#100F18", color: "#FBF8F2" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 48 }}>
          <svg width="60" height="54" viewBox="0 0 30 27" fill="none">
            <path d="M15 1 L29 25 L1 25 Z" stroke="#D3A758" strokeWidth="2.2" fill="none" />
            <circle cx="15" cy="18" r="3" fill="#D3A758" />
          </svg>
          <span style={{ fontSize: 34, letterSpacing: 8, color: "#D3A758", fontWeight: 700 }}>ALIGNED</span>
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15, maxWidth: 980 }}>{HERO.promise}</div>
        <div style={{ fontSize: 34, color: "#A5ADBF", marginTop: 28 }}>{HERO.support}</div>
      </div>
    ),
    { ...size }
  );
}
