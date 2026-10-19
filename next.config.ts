import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browsers ask for /favicon.ico by habit; serve the generated icon.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
};

export default nextConfig;
