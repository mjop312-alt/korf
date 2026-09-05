// Bouwt de invoer voor de scenario-engine (CanonicalProduct[] + Supermarket[])
// uit de DATABASE — dus prijzen met een echte collectedAt, klaar voor de
// versheids-indicator. Gecachet (unstable_cache) omdat /api/compare vaak wordt
// aangeroepen; na `npm run ingest` verloopt de cache vanzelf (revalidate).

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import type { CanonicalProduct, Promotion, StoreProduct, Supermarket, Unit } from "@/lib/types";

export interface CompareCatalog {
  catalog: CanonicalProduct[];
  supermarkets: Supermarket[];
  /** Oudste prijs­controle per winkel-slug + globaal, als ISO-string. */
  freshness: { oldest: string | null; byStore: Record<string, string> };
}

async function build(): Promise<CompareCatalog> {
  const [sms, canon, prices] = await Promise.all([
    db.supermarket.findMany({ orderBy: { slug: "asc" } }),
    db.canonicalProduct.findMany({
      include: {
        category: true,
        storeProducts: {
          where: { available: true, price: { isNot: null } },
          include: {
            supermarket: { select: { slug: true } },
            brand: { select: { name: true, isOwnBrand: true } },
            price: { include: { promotion: true } },
          },
        },
      },
    }),
    db.price.findMany({
      select: { collectedAt: true, storeProduct: { select: { supermarket: { select: { slug: true } } } } },
    }),
  ]);

  const supermarkets: Supermarket[] = sms.map((s) => ({
    id: s.slug,
    name: s.name,
    short: s.short,
    brandColor: s.brandColor,
  }));

  const catalog: CanonicalProduct[] = canon
    .map((c) => {
      const variants: StoreProduct[] = c.storeProducts
        .filter((sp) => sp.price)
        .map((sp) => {
          const p = sp.price!;
          let promo: Promotion | undefined;
          if (p.promotion) {
            promo = {
              priceCents: p.isPromo && p.promoPriceCents != null ? p.promoPriceCents : null,
              label: p.promotion.label,
              endsAt: p.promotion.endsAt.toISOString(),
            };
          }
          return {
            store: sp.supermarket.slug,
            brand: sp.brand.name,
            ownBrand: sp.brand.isOwnBrand,
            priceCents: p.priceCents,
            unitPriceCents: p.unitPriceCents ?? undefined,
            promo,
          };
        });
      return {
        id: c.slug,
        name: c.name,
        category: c.category.name,
        baseUnit: c.baseUnit as Unit,
        imageUrl: c.imageUrl ?? undefined,
        variants,
      };
    })
    .filter((c) => c.variants.length > 0);

  const byStore: Record<string, string> = {};
  let oldest: Date | null = null;
  for (const pr of prices) {
    const slug = pr.storeProduct.supermarket.slug;
    if (!byStore[slug] || pr.collectedAt < new Date(byStore[slug])) {
      byStore[slug] = pr.collectedAt.toISOString();
    }
    if (!oldest || pr.collectedAt < oldest) oldest = pr.collectedAt;
  }

  return { catalog, supermarkets, freshness: { oldest: oldest?.toISOString() ?? null, byStore } };
}

// Gecachet: /api/compare wordt vaak aangeroepen maar de catalogus verandert alleen
// bij een ingestion-run. Na `npm run ingest` / `db:seed` is de cache max 60s stale.
export const getCompareCatalog = unstable_cache(build, ["compare-catalog"], {
  revalidate: 60,
  tags: ["catalog"],
});

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
