import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

// de zware groepen-query hoeft niet bij elk bezoek van een crawler te draaien
export const revalidate = 3600;

// Zet in productie op de echte domeinnaam.
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const STATIC_PATHS = ["", "/hoe-het-werkt", "/betrouwbaarheid", "/over", "/privacy", "/voorwaarden", "/aanbiedingen", "/producten"];

// Alleen productgroepen die in minstens twee winkels te koop zijn (dáár is vergelijken zinvol),
// gemaximeerd: sitemaps mogen 50.000 URL's bevatten.
const MAX_PRODUCTS = 20_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const groups = await db.$queryRaw<{ slug: string }[]>`
    SELECT cp.slug
    FROM "CanonicalProduct" cp
    JOIN "StoreProduct" sp ON sp."canonicalProductId" = cp.id AND sp.available
    GROUP BY cp.slug
    HAVING COUNT(DISTINCT sp."supermarketId") >= 2
    ORDER BY COUNT(*) DESC, cp.slug
    LIMIT ${MAX_PRODUCTS}`;
  return [
    ...STATIC_PATHS.map((path) => ({
      url: `${BASE_URL}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.6,
    })),
    ...groups.map((p) => ({
      url: `${BASE_URL}/product/${p.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
  ];
}
