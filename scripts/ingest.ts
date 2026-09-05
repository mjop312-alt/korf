// Korf — ingestion-worker.
//
//   npm run ingest
//
// Haalt bij elke actieve provider het assortiment op, normaliseert, en schrijft
// naar de database: store_products (upsert), prices (upsert, verse collectedAt) en
// price_history (nieuwe momentopname). Draai dit periodiek via cron — NOOIT in het
// request-pad van de app.
//
// Voor de MockProvider komt er dezelfde demodata uit, met een nieuwe collectedAt;
// dat toont de pijplijn. Echte connectors implementeren `PriceProvider`.

import { PrismaClient } from "@prisma/client";
import { activeProviders } from "../lib/providers/index";
import type { NormalisedProduct } from "../lib/providers/types";

const db = new PrismaClient();

async function upsertOne(p: NormalisedProduct) {
  const supermarket = await db.supermarket.findUnique({ where: { slug: p.supermarketSlug } });
  if (!supermarket) return { skipped: true };

  const brand = await db.brand.upsert({
    where: { name: p.brand },
    update: {},
    create: { name: p.brand, isOwnBrand: p.ownBrand },
  });

  const canonical = p.canonicalSlug
    ? await db.canonicalProduct.findUnique({ where: { slug: p.canonicalSlug } })
    : null;

  // uniek genoeg voor de mock: winkel + titel
  const existing = await db.storeProduct.findFirst({
    where: { supermarketId: supermarket.id, title: p.title },
  });

  const storeProduct = existing
    ? await db.storeProduct.update({
        where: { id: existing.id },
        data: { brandId: brand.id, canonicalProductId: canonical?.id ?? existing.canonicalProductId, available: true },
      })
    : await db.storeProduct.create({
        data: {
          supermarketId: supermarket.id,
          brandId: brand.id,
          canonicalProductId: canonical?.id ?? null,
          title: p.title,
          packUnit: p.packUnit ?? null,
          available: true,
        },
      });

  let promotionId: string | null = null;
  if (p.promo) {
    const ends = new Date(p.promo.endsAt);
    const promo = await db.promotion.findFirst({
      where: { supermarketId: supermarket.id, label: p.promo.label, endsAt: ends },
    });
    promotionId =
      promo?.id ??
      (
        await db.promotion.create({
          data: {
            supermarketId: supermarket.id,
            mechanism: p.promo.priceCents != null ? "price_off" : "x_for_y",
            label: p.promo.label,
            startsAt: new Date(ends.getTime() - 7 * 86_400_000),
            endsAt: ends,
            autoApplied: p.promo.priceCents != null,
          },
        })
      ).id;
  }

  await db.price.upsert({
    where: { storeProductId: storeProduct.id },
    update: {
      priceCents: p.priceCents,
      unitPriceCents: p.unitPriceCents ?? null,
      isPromo: !!p.promo,
      promoPriceCents: p.promo?.priceCents ?? null,
      promotionId,
      collectedAt: new Date(),
    },
    create: {
      storeProductId: storeProduct.id,
      priceCents: p.priceCents,
      unitPriceCents: p.unitPriceCents ?? null,
      isPromo: !!p.promo,
      promoPriceCents: p.promo?.priceCents ?? null,
      promotionId,
      source: "mock",
    },
  });

  await db.priceHistory.create({
    data: {
      storeProductId: storeProduct.id,
      priceCents: p.priceCents,
      promoPriceCents: p.promo?.priceCents ?? null,
    },
  });

  return { ok: true };
}

async function main() {
  const providers = activeProviders();
  for (const provider of providers) {
    const rows = provider.listAll ? await provider.listAll() : [];
    let ok = 0;
    let skipped = 0;
    for (const row of rows) {
      const r = await upsertOne(row);
      if ("ok" in r) ok++;
      else skipped++;
    }
    console.log(`[${provider.slug}] ${ok} bijgewerkt, ${skipped} overgeslagen`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
