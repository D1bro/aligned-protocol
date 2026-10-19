import type { MetadataRoute } from "next";
import { LEGAL, SITE } from "@/lib/site-copy";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE.url}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE.url}/audit`, changeFrequency: "monthly", priority: 0.8 },
    ...(LEGAL.approved
      ? [
          { url: `${SITE.url}/privacy`, changeFrequency: "yearly" as const, priority: 0.2 },
          { url: `${SITE.url}/terms`, changeFrequency: "yearly" as const, priority: 0.2 },
        ]
      : []),
  ];
}
