import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site-copy";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE.url}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE.url}/audit`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
