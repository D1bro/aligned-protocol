import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browsers ask for /favicon.ico by habit; serve the generated icon.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
  // Nov 2026 (brief v4.0): My Plan, My Journey and the Journal moved. Emails
  // already sent and saved links still use the old addresses; query strings
  // (?edit=4, ?latest=1) carry over.
  async redirects() {
    return [
      { source: "/clear", destination: "/plan", permanent: true },
      { source: "/clear/:path*", destination: "/plan/:path*", permanent: true },
      { source: "/goals", destination: "/plan", permanent: true },
      { source: "/summary", destination: "/journey", permanent: true },
      { source: "/alignment/journal", destination: "/journal", permanent: true },
    ];
  },
};

export default nextConfig;
