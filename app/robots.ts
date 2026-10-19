import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site-copy";

// Search engines may index the homepage and the audit welcome page only.
// Everything personal (profiles, plans, results, the console) is kept out,
// and those pages also say "noindex" themselves.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/audit/",
        "/home",
        "/clear",
        "/alignment",
        "/details",
        "/goals",
        "/summary",
        "/coaching",
        "/tools",
        "/learn",
        "/musings",
        "/podcast",
        "/coach",
        "/login",
        "/reset-password",
        "/auth",
        "/api",
      ],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
