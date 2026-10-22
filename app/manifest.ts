import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site-copy";

// Lets people add Aligned to their phone's home screen, where it opens
// full-screen like an app. No offline caching: every page is always live.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aligned",
    short_name: "Aligned",
    description: SITE.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#100F18",
    theme_color: "#100F18",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
