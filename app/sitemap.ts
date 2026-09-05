import type { MetadataRoute } from "next";
import { CATALOG } from "@/lib/mock-data";

// Zet in productie op de echte domeinnaam.
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const STATIC_PATHS = ["", "/hoe-het-werkt", "/betrouwbaarheid", "/over", "/privacy", "/voorwaarden", "/aanbiedingen"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...STATIC_PATHS.map((path) => ({
      url: `${BASE_URL}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.6,
    })),
    ...CATALOG.map((p) => ({
      url: `${BASE_URL}/product/${p.id}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];
}
