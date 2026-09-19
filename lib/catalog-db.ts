// Bouwt de invoer voor de scenario-engine (CanonicalProduct[] + Supermarket[]) uit de
// DATABASE. Een "canoniek product" is een productgroep uit de crawl (zie lib/crawl/group.ts):
// alle merken en huismerken van hetzelfde soort product in dezelfde hoeveelheid, over alle
// winkels. We laden alleen de groepen die een lijst/vergelijking nodig heeft — de catalogus
// telt tienduizenden groepen.

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import type { CanonicalProduct, Promotion, StoreProduct, Supermarket, Unit } from "@/lib/types";

export interface CompareCatalog {
  catalog: CanonicalProduct[];
  supermarkets: Supermarket[];
  /** Laatste volledige controle per winkel-slug + de oudste daarvan, als ISO-string. */
  freshness: { oldest: string | null; byStore: Record<string, string> };
}

const loadSupermarkets = unstable_cache(
  async (): Promise<Supermarket[]> => {
    const sms = await db.supermarket.findMany({ orderBy: { slug: "asc" } });
    return sms.map((s) => ({ id: s.slug, name: s.name, short: s.short, brandColor: s.brandColor }));
  },
  ["supermarkets"],
  { revalidate: 3600, tags: ["catalog"] },
);

/**
 * Hoe vers is de data per winkel? Laatste VOLLEDIGE geslaagde crawl-ronde; bij ontbreken
 * (bv. een winkel die alleen via losse runs is gevuld) de laatst bevestigde prijs.
 */
const loadFreshness = unstable_cache(
  async (): Promise<CompareCatalog["freshness"]> => {
    const [runs, seen] = await Promise.all([
      db.$queryRaw<{ store: string; at: Date }[]>`
        SELECT store, MAX("finishedAt") AS at FROM "CrawlRun"
        WHERE ok AND NOT partial AND "finishedAt" IS NOT NULL GROUP BY store`,
      db.$queryRaw<{ store: string; at: Date }[]>`
        SELECT s.slug AS store, MAX(p."collectedAt") AS at
        FROM "Price" p JOIN "StoreProduct" sp ON sp.id = p."storeProductId"
        JOIN "Supermarket" s ON s.id = sp."supermarketId"
        WHERE sp."externalId" IS NOT NULL GROUP BY s.slug`,
    ]);
    const byStore: Record<string, string> = {};
    for (const r of seen) byStore[r.store] = r.at.toISOString();
    for (const r of runs) byStore[r.store] = r.at.toISOString(); // een volledige ronde is sterker bewijs
    const times = Object.values(byStore).sort();
    return { oldest: times[0] ?? null, byStore };
  },
  ["freshness"],
  { revalidate: 60, tags: ["catalog"] },
);

interface VariantRow {
  group_slug: string;
  name: string;
  category: string;
  base_unit: string;
  group_image: string | null;
  store: string;
  brand: string;
  own: boolean;
  title: string;
  pack: string | null;
  url: string | null;
  image: string | null;
  price_cents: number;
  unit_cents: number | null;
  promo_price_cents: number | null;
  promo_label: string | null;
  promo_ends: Date | null;
  promo_active: boolean;
}

/**
 * De gevraagde groepen met hun varianten: per winkel × merk het goedkoopste artikel (dat is
 * genoeg — de engine kiest per merkvoorkeur altijd de goedkoopste passende variant).
 */
export async function loadGroups(slugs: string[]): Promise<CanonicalProduct[]> {
  const unique = [...new Set(slugs)];
  if (!unique.length) return [];

  const rows = await db.$queryRaw<VariantRow[]>`
    SELECT DISTINCT ON (cp.slug, s.slug, b.id)
      cp.slug AS group_slug, cp.name, c.name AS category, cp."baseUnit" AS base_unit, cp."imageUrl" AS group_image,
      s.slug AS store, b.name AS brand, b."isOwnBrand" AS own,
      sp.title, sp."packLabel" AS pack, sp."externalUrl" AS url, sp."imageUrl" AS image,
      pr."priceCents" AS price_cents, pr."unitPriceCents" AS unit_cents,
      pr."promoPriceCents" AS promo_price_cents, pm.label AS promo_label, pm."endsAt" AS promo_ends,
      (pr."isPromo" AND (pm."endsAt" IS NULL OR pm."endsAt" >= now())) AS promo_active
    FROM "CanonicalProduct" cp
    JOIN "Category" c ON c.id = cp."categoryId"
    JOIN "StoreProduct" sp ON sp."canonicalProductId" = cp.id AND sp.available AND sp."externalId" IS NOT NULL
    JOIN "Supermarket" s ON s.id = sp."supermarketId"
    JOIN "Brand" b ON b.id = sp."brandId"
    JOIN "Price" pr ON pr."storeProductId" = sp.id
    LEFT JOIN "Promotion" pm ON pm.id = pr."promotionId"
    WHERE cp.slug = ANY(${unique}::text[])
    ORDER BY cp.slug, s.slug, b.id,
      CASE WHEN pr."isPromo" AND pr."promoPriceCents" IS NOT NULL AND (pm."endsAt" IS NULL OR pm."endsAt" >= now())
           THEN pr."promoPriceCents" ELSE pr."priceCents" END ASC`;

  const byGroup = new Map<string, CanonicalProduct>();
  for (const r of rows) {
    let g = byGroup.get(r.group_slug);
    if (!g) {
      g = {
        id: r.group_slug,
        name: r.name,
        category: r.category,
        baseUnit: r.base_unit as Unit,
        imageUrl: r.group_image ?? undefined,
        variants: [],
      };
      byGroup.set(r.group_slug, g);
    }
    let promo: Promotion | undefined;
    if (r.promo_active && r.promo_label && r.promo_ends) {
      promo = { priceCents: r.promo_price_cents, label: r.promo_label, endsAt: r.promo_ends.toISOString() };
    }
    const v: StoreProduct = {
      store: r.store,
      brand: r.brand,
      ownBrand: r.own,
      priceCents: r.price_cents,
      unitPriceCents: r.unit_cents ?? undefined,
      promo,
      imageUrl: r.image ?? undefined,
      title: r.title,
      packLabel: r.pack ?? undefined,
      url: r.url ?? undefined,
    };
    g.variants.push(v);
  }
  // Een groep met precies één A-merk krijgt dat merk in de naam ("Coca-Cola Cherry 1,5 l" i.p.v.
  // "Cherry 1,5 l"); groepen met meerdere merken of huismerken houden de generieke naam.
  for (const g of byGroup.values()) {
    const brands = new Set(g.variants.map((v) => v.brand));
    if (brands.size === 1 && !g.variants[0].ownBrand) {
      const b = g.variants[0].brand;
      if (!g.name.toLowerCase().includes(b.toLowerCase())) g.name = `${b} ${g.name}`;
    }
  }
  // behoud de volgorde waarin gevraagd werd (lijstvolgorde)
  return unique.map((s) => byGroup.get(s)).filter((g): g is CanonicalProduct => !!g);
}

/** Alles wat een pagina nodig heeft om een lijst door te rekenen. */
export async function getCompareCatalog(slugs: string[]): Promise<CompareCatalog> {
  const [catalog, supermarkets, freshness] = await Promise.all([loadGroups(slugs), loadSupermarkets(), loadFreshness()]);
  return { catalog, supermarkets, freshness };
}

export const getSupermarkets = loadSupermarkets;
export const getFreshness = loadFreshness;

/** Menselijke "x geleden" + of het boven de versheidsdrempel zit. */
export function freshnessLabel(iso: string | null, staleHours = 24): { text: string; stale: boolean } {
  if (!iso) return { text: "onbekend", stale: true };
  const ageMs = Date.now() - new Date(iso).getTime();
  const h = ageMs / 3_600_000;
  const stale = h > staleHours;
  if (h < 1) return { text: "net gecontroleerd", stale };
  if (h < 24) return { text: `${Math.round(h)} uur geleden`, stale };
  return { text: `${Math.round(h / 24)} dag(en) geleden`, stale };
}
