// Lees-kant van aanbiedingen en productdetail. Server components.

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

export async function getOffers(opts: { store?: string; category?: string } = {}): Promise<OfferView[]> {
  const now = new Date();
  const prices = await db.price.findMany({
    where: {
      isPromo: true,
      promotion: { endsAt: { gte: now } },
      ...(opts.store ? { storeProduct: { supermarket: { slug: opts.store } } } : {}),
      ...(opts.category
        ? { storeProduct: { canonicalProduct: { category: { slug: opts.category } } } }
        : {}),
    },
    include: {
      promotion: true,
      storeProduct: {
        include: {
          brand: true,
          supermarket: true,
          canonicalProduct: { include: { category: true } },
        },
      },
    },
  });

  return prices
    .filter((p) => p.storeProduct.canonicalProduct)
    .map((p) => {
      const cp = p.storeProduct.canonicalProduct!;
      const promoCents = p.promoPriceCents ?? null;
      return {
        canonicalSlug: cp.slug,
        productName: cp.name,
        category: cp.category.name,
        storeSlug: p.storeProduct.supermarket.slug,
        storeName: p.storeProduct.supermarket.name,
        storeColor: p.storeProduct.supermarket.brandColor,
        brand: p.storeProduct.brand.name,
        normalCents: p.priceCents,
        promoCents,
        label: p.promotion!.label,
        endsAt: p.promotion!.endsAt.toISOString(),
        pctOff:
          promoCents != null && p.priceCents > 0
            ? Math.round((1 - promoCents / p.priceCents) * 100)
            : null,
      };
    })
    .sort((a, b) => (b.pctOff ?? 0) - (a.pctOff ?? 0));
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
