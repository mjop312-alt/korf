// Lees-kant van aanbiedingen en productdetail. Server components.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface OfferView {
  canonicalSlug: string;
  productName: string;
  category: string;
  storeSlug: string;
  storeName: string;
  storeColor: string;
  brand: string;
  normalCents: number;
  promoCents: number | null;
  label: string;
  endsAt: string;
  pctOff: number | null;
}

export const OFFERS_PAGE_SIZE = 30;

/** Lopende aanbiedingen, met de hoogste korting (%) eerst; gepagineerd. */
export async function getOffers(
  opts: { store?: string; category?: string; page?: number } = {},
): Promise<{ total: number; offers: OfferView[] }> {
  const page = Math.max(opts.page ?? 1, 1);
  const where = [
    Prisma.sql`pr."isPromo" AND pr."promoPriceCents" IS NOT NULL AND pm."endsAt" >= now()`,
    Prisma.sql`sp.available AND sp."canonicalProductId" IS NOT NULL`,
  ];
  if (opts.store) where.push(Prisma.sql`s.slug = ${opts.store}`);
  if (opts.category) where.push(Prisma.sql`c.slug = ${opts.category}`);

  const rows = await db.$queryRaw<
    {
      slug: string; name: string; category: string; store_slug: string; store_name: string; store_color: string;
      brand: string; normal: number; promo: number; label: string; ends: Date; total: number;
    }[]
  >`
    SELECT cp.slug, cp.name, c.name AS category, s.slug AS store_slug, s.name AS store_name, s."brandColor" AS store_color,
           b.name AS brand, pr."priceCents" AS normal, pr."promoPriceCents" AS promo, pm.label, pm."endsAt" AS ends,
           (COUNT(*) OVER())::int AS total
    FROM "Price" pr
    JOIN "Promotion" pm ON pm.id = pr."promotionId"
    JOIN "StoreProduct" sp ON sp.id = pr."storeProductId"
    JOIN "Supermarket" s ON s.id = sp."supermarketId"
    JOIN "Brand" b ON b.id = sp."brandId"
    JOIN "CanonicalProduct" cp ON cp.id = sp."canonicalProductId"
    JOIN "Category" c ON c.id = cp."categoryId"
    WHERE ${Prisma.join(where, " AND ")}
    ORDER BY (1 - pr."promoPriceCents"::float / NULLIF(pr."priceCents", 0)) DESC NULLS LAST, cp.name
    LIMIT ${OFFERS_PAGE_SIZE} OFFSET ${(page - 1) * OFFERS_PAGE_SIZE}`;

  return {
    total: rows[0]?.total ?? 0,
    offers: rows.map((r) => ({
      canonicalSlug: r.slug,
      productName: r.name,
      category: r.category,
      storeSlug: r.store_slug,
      storeName: r.store_name,
      storeColor: r.store_color,
      brand: r.brand,
      normalCents: r.normal,
      promoCents: r.promo,
      label: r.label,
      endsAt: r.ends.toISOString(),
      pctOff: r.normal > 0 ? Math.round((1 - r.promo / r.normal) * 100) : null,
    })),
  };
}

export async function getOfferFilters() {
  const [stores, categories] = await Promise.all([
    db.supermarket.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);
  return { stores, categories };
}

/* ─────────────── productdetail ─────────────── */

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductDetail>>>;

export async function getProductDetail(slug: string) {
  const cp = await db.canonicalProduct.findUnique({
    where: { slug },
    include: {
      category: true,
      storeProducts: {
        where: { available: true, price: { isNot: null } },
        include: {
          brand: true,
          supermarket: true,
          price: { include: { promotion: true } },
        },
      },
    },
  });
  if (!cp) return null;

  const offers = cp.storeProducts
    .filter((sp) => sp.price)
    .map((sp) => {
      const p = sp.price!;
      const effective = p.isPromo && p.promoPriceCents != null ? p.promoPriceCents : p.priceCents;
      return {
        storeSlug: sp.supermarket.slug,
        storeName: sp.supermarket.name,
        storeColor: sp.supermarket.brandColor,
        brand: sp.brand.name,
        ownBrand: sp.brand.isOwnBrand,
        title: sp.title,
        priceCents: p.priceCents,
        effectiveCents: effective,
        unitPriceCents: p.unitPriceCents ?? null,
        isPromo: p.isPromo,
        promoLabel: p.promotion?.label ?? null,
        promoEndsAt: p.promotion?.endsAt.toISOString() ?? null,
        collectedAt: p.collectedAt.toISOString(),
      };
    })
    .sort((a, b) => a.effectiveCents - b.effectiveCents);

  const alternatives = await db.canonicalProduct.findMany({
    where: { categoryId: cp.categoryId, slug: { not: slug } },
    take: 6,
    include: {
      storeProducts: {
        where: { price: { isNot: null } },
        include: { price: true, supermarket: { select: { slug: true } } },
      },
    },
  });

  return {
    slug: cp.slug,
    name: cp.name,
    category: cp.category.name,
    categorySlug: cp.category.slug,
    baseUnit: cp.baseUnit,
    imageUrl: cp.imageUrl,
    offers,
    lowest: offers[0] ?? null,
    alternatives: alternatives
      .map((a) => {
        const cents = a.storeProducts
          .map((sp) =>
            sp.price
              ? sp.price.isPromo && sp.price.promoPriceCents != null
                ? sp.price.promoPriceCents
                : sp.price.priceCents
              : Infinity,
          )
          .sort((x, y) => x - y)[0];
        return { slug: a.slug, name: a.name, lowestCents: Number.isFinite(cents) ? cents : null };
      })
      .filter((a) => a.lowestCents != null),
  };
}

/** Prijshistorie per winkel, voor de grafiek. */
export async function getPriceHistory(slug: string, months = 3) {
  const since = new Date(Date.now() - months * 31 * 86_400_000);
  const cp = await db.canonicalProduct.findUnique({
    where: { slug },
    select: {
      storeProducts: {
        where: { price: { isNot: null } },
        select: {
          supermarket: { select: { slug: true, name: true, brandColor: true } },
          priceHistory: {
            where: { observedAt: { gte: since } },
            orderBy: { observedAt: "asc" },
            select: { observedAt: true, priceCents: true, promoPriceCents: true },
          },
        },
      },
    },
  });
  if (!cp) return [];

  // per winkel samenvoegen: meerdere merken → laagste prijs per DAG (tijdstempels
  // van losse store_products lopen niet exact gelijk).
  const dayKey = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const byStore = new Map<string, { name: string; color: string; points: Map<number, number> }>();
  for (const sp of cp.storeProducts) {
    const key = sp.supermarket.slug;
    const entry =
      byStore.get(key) ?? { name: sp.supermarket.name, color: sp.supermarket.brandColor, points: new Map() };
    for (const h of sp.priceHistory) {
      const t = dayKey(h.observedAt);
      const cents = h.promoPriceCents ?? h.priceCents;
      const prev = entry.points.get(t);
      if (prev == null || cents < prev) entry.points.set(t, cents);
    }
    byStore.set(key, entry);
  }

  return [...byStore.entries()].map(([slug, e]) => ({
    storeSlug: slug,
    storeName: e.name,
    color: e.color,
    points: [...e.points.entries()].sort((a, b) => a[0] - b[0]).map(([t, cents]) => ({ t, cents })),
  }));
}

export interface SizeVariant {
  slug: string;
  name: string;
  baseUnit: string;
  /** goedkoopste eenheidsprijs (per kg / l / stuk, in centen) en de winkel waar die geldt */
  unitCents: number | null;
  unitStore: string | null;
  lowestCents: number;
  stores: string[];
}

/**
 * Andere verpakkingen van hetzelfde soort product (zelfde kernwoorden, andere hoeveelheid),
 * zodat je ook verschillende maten eerlijk op prijs per kilo/liter kunt vergelijken.
 */
export async function getSizeVariants(slug: string): Promise<SizeVariant[]> {
  const rows = await db.$queryRaw<
    { slug: string; name: string; base_unit: string; unit: number | null; unit_store: string | null; lowest: number; stores: string[] }[]
  >`
    WITH me AS (
      SELECT DISTINCT split_part(sp."matchKey", '|', 1) AS core
      FROM "StoreProduct" sp JOIN "CanonicalProduct" cp ON cp.id = sp."canonicalProductId"
      WHERE cp.slug = ${slug} AND sp."matchKey" IS NOT NULL
      LIMIT 1
    ), p AS (
      SELECT cp.slug, cp.name, cp."baseUnit" AS base_unit, s.slug AS store, pr."unitPriceCents" AS unit,
             CASE WHEN pr."isPromo" AND pr."promoPriceCents" IS NOT NULL THEN pr."promoPriceCents" ELSE pr."priceCents" END AS cents
      FROM "StoreProduct" sp
      JOIN me ON split_part(sp."matchKey", '|', 1) = me.core
      JOIN "CanonicalProduct" cp ON cp.id = sp."canonicalProductId"
      JOIN "Supermarket" s ON s.id = sp."supermarketId"
      JOIN "Price" pr ON pr."storeProductId" = sp.id
      WHERE sp.available AND cp.slug <> ${slug}
        AND cp."baseUnit" = (SELECT "baseUnit" FROM "CanonicalProduct" WHERE slug = ${slug})
    )
    SELECT slug, name, base_unit, MIN(unit) AS unit, (array_agg(store ORDER BY unit NULLS LAST))[1] AS unit_store,
           MIN(cents)::int AS lowest, array_agg(DISTINCT store) AS stores
    FROM p GROUP BY slug, name, base_unit
    ORDER BY MIN(unit) NULLS LAST, name
    LIMIT 12`;
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    baseUnit: r.base_unit,
    unitCents: r.unit,
    unitStore: r.unit_store,
    lowestCents: r.lowest,
    stores: r.stores,
  }));
}
