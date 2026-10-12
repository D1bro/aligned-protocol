// Brand assets in one place. To swap in a new logo, replace the files in
// public/brand/ (keeping these names) — nothing else needs to change.
export const BRAND = {
  // Gold symbol on a transparent background, cropped from the full logo.
  symbol: { src: "/brand/aligned-symbol.png", width: 256, height: 219 },
  // Full supplied logo (symbol + wordmark on the dark brand background).
  full: { src: "/brand/aligned-logo.png", width: 2000, height: 2000 },
} as const;
