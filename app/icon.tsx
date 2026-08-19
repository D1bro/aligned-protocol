import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050818",
        }}
      >
        <svg width="20" height="18" viewBox="0 0 30 27" fill="none">
          <path d="M15 1 L29 25 L1 25 Z" stroke="#E0B140" strokeWidth="2.6" fill="none" />
          <circle cx="15" cy="18" r="3" fill="#E0B140" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
