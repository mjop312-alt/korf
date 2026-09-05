// Korf — seed. Zet de mockdata (lib/mock-data.ts) in de database, plus een
// demo-account met een voorbeeldlijst. Idempotent: wist eerst alles.
//
//   npm run db:seed      (of: npm run db:reset  om schema + seed opnieuw te doen)
//
// Demo-login:  demo@korf.nl / demo1234

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { CATALOG, SUPERMARKETS } from "../lib/mock-data";

const db = new PrismaClient();

const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "en").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const DAY = 86_400_000;

/** ~15 wekelijkse prijs-momentopnames voor de prijshistorie-grafiek. */
function weeklyHistory(storeProductId: string, currentCents: number, promoPriceCents: number | null) {
  const now = Date.now();
  const WEEKS = 15;
  const rows: { storeProductId: string; priceCents: number; promoPriceCents: number | null; observedAt: Date }[] = [];
  for (let w = WEEKS; w >= 1; w--) {
    // rustige ruis rond de huidige prijs, licht stijgende trend naar nu toe
    const trend = 1 - (w / WEEKS) * 0.05;
    const noise = 0.94 + Math.random() * 0.12;
    const price = Math.max(50, Math.round(currentCents * trend * noise));
    // af en toe een actieweek als dit product ooit in de actie is
    const promoWeek = promoPriceCents != null && (w === 6 || w === 11);
    rows.push({
      storeProductId,
      priceCents: price,
      promoPriceCents: promoWeek ? Math.round(promoPriceCents * (0.97 + Math.random() * 0.06)) : null,
      observedAt: new Date(now - w * 7 * DAY),
    });
  }
  rows.push({ storeProductId, priceCents: currentCents, promoPriceCents, observedAt: new Date(now) });
  return rows;
}

async function wipe() {
  // volgorde: kinderen eerst
  await db.priceHistory.deleteMany();
  await db.price.deleteMany();
  await db.promotion.deleteMany();
  await db.shoppingListItem.deleteMany();
  await db.listShare.deleteMany();
  await db.shoppingList.deleteMany();
  await db.priceAlert.deleteMany();
  await db.favoriteProduct.deleteMany();
  await db.storeProduct.deleteMany();
  await db.storeLocation.deleteMany();
  await db.canonicalProduct.deleteMany();
  await db.brand.deleteMany();
  await db.category.deleteMany();
  await db.supermarket.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.userPreference.deleteMany();
  await db.user.deleteMany();
}

async function main() {
  await wipe();

  // ── supermarkten ──
  const storeIdBySlug = new Map<string, string>();
  for (const s of SUPERMARKETS) {
    const row = await db.supermarket.create({
      data: {
        slug: s.id,
        name: s.name,
        short: s.short,
        brandColor: s.brandColor,
        hasOnlineCatalogue: s.id !== "lidl",
        dataProvider: "mock",
      },
    });
    storeIdBySlug.set(s.id, row.id);
  }

  // ── één filiaal per winkel (Amsterdam-centrum, fictief) ──
  const AMS: Record<string, [number, number]> = {
    ah: [52.372, 4.892],
    jumbo: [52.366, 4.9],
    lidl: [52.378, 4.9],
  };
  for (const s of SUPERMARKETS) {
    await db.storeLocation.create({
      data: {
        supermarketId: storeIdBySlug.get(s.id)!,
        address: `${s.name} Centrum`,
        postcode: "1012 AB",
        city: "Amsterdam",
        lat: AMS[s.id][0],
        lng: AMS[s.id][1],
        services: { pickup: true, delivery: s.id !== "lidl" },
      },
    });
  }

  // ── categorieën ──
  const catIdBySlug = new Map<string, string>();
  const catNames = [...new Set(CATALOG.map((c) => c.category))];
  for (const name of catNames) {
    const row = await db.category.create({ data: { slug: slugify(name), name } });
    catIdBySlug.set(name, row.id);
  }

  // ── merken ──
  // isOwnBrand: waar bij minstens één variant ownBrand true is.
  // ownerSupermarket: als álle varianten van dat merk bij één winkel zitten én own zijn.
  const brandInfo = new Map<string, { own: boolean; stores: Set<string> }>();
  for (const p of CATALOG) {
    for (const v of p.variants) {
      const b = brandInfo.get(v.brand) ?? { own: false, stores: new Set() };
      if (v.ownBrand) b.own = true;
      b.stores.add(v.store);
      brandInfo.set(v.brand, b);
    }
  }
  const brandIdByName = new Map<string, string>();
  for (const [name, info] of brandInfo) {
    const single = info.own && info.stores.size === 1 ? [...info.stores][0] : null;
    const row = await db.brand.create({
      data: {
        name,
        isOwnBrand: info.own,
        ownerSupermarketId: single ? storeIdBySlug.get(single)! : null,
      },
    });
    brandIdByName.set(name, row.id);
  }

  // ── canonieke producten ──
  const canonIdBySlug = new Map<string, string>();
  for (const p of CATALOG) {
    const row = await db.canonicalProduct.create({
      data: {
        slug: p.id,
        name: p.name,
        categoryId: catIdBySlug.get(p.category)!,
        baseUnit: p.baseUnit,
        baseSize: 1,
      },
    });
    canonIdBySlug.set(p.id, row.id);
  }

  // ── promoties (uniek op label+winkel+einddatum) ──
  const promoKey = (store: string, label: string, endsAt: string) => `${store}|${label}|${endsAt}`;
  const promoIdByKey = new Map<string, string>();
  for (const p of CATALOG) {
    for (const v of p.variants) {
      if (!v.promo) continue;
      const key = promoKey(v.store, v.promo.label, v.promo.endsAt);
      if (promoIdByKey.has(key)) continue;
      const ends = new Date(v.promo.endsAt);
      const row = await db.promotion.create({
        data: {
          supermarketId: storeIdBySlug.get(v.store)!,
          mechanism: v.promo.priceCents != null ? "price_off" : "x_for_y",
          label: v.promo.label,
          value: v.promo.priceCents != null ? { priceCents: v.promo.priceCents } : { text: v.promo.label },
          startsAt: new Date(ends.getTime() - 7 * DAY),
          endsAt: ends,
          autoApplied: v.promo.priceCents != null,
        },
      });
      promoIdByKey.set(key, row.id);
    }
  }

  // ── winkelproducten + prijzen + historie ──
  let storeProductCount = 0;
  for (const p of CATALOG) {
    for (const v of p.variants) {
      const sp = await db.storeProduct.create({
        data: {
          supermarketId: storeIdBySlug.get(v.store)!,
          canonicalProductId: canonIdBySlug.get(p.id)!,
          brandId: brandIdByName.get(v.brand)!,
          title: `${v.brand} ${p.name}`,
          available: true,
        },
      });
      storeProductCount++;

      const promoId = v.promo
        ? promoIdByKey.get(promoKey(v.store, v.promo.label, v.promo.endsAt)) ?? null
        : null;

      await db.price.create({
        data: {
          storeProductId: sp.id,
          priceCents: v.priceCents,
          unitPriceCents: v.unitPriceCents ?? null,
          isPromo: !!v.promo,
          promoPriceCents: v.promo?.priceCents ?? null,
          promotionId: promoId,
          source: "mock",
        },
      });

      await db.priceHistory.createMany({
        data: weeklyHistory(sp.id, v.priceCents, v.promo?.priceCents ?? null),
      });
    }
  }

  // ── demo-account ──
  const user = await db.user.create({
    data: {
      email: "demo@korf.nl",
      name: "Demo",
      passwordHash: await bcrypt.hash("demo1234", 10),
      preference: {
        create: {
          postcode: "1012 AB",
          radiusKm: 5,
          selectedStoreIds: SUPERMARKETS.map((s) => s.id),
          defaultBrandMode: "any",
        },
      },
    },
  });

  const list = await db.shoppingList.create({
    data: { ownerId: user.id, name: "Wekelijkse boodschappen", isActive: true, templateKey: "weekly" },
  });
  const starter: Array<[string, number, string | null]> = [
    ["melk", 2, null],
    ["brood", 1, null],
    ["koffie", 1, null],
    ["pindakaas", 1, "Calvé"],
    ["bananen", 1, null],
  ];
  let pos = 0;
  for (const [slug, qty, pinnedBrand] of starter) {
    const cp = CATALOG.find((c) => c.id === slug)!;
    await db.shoppingListItem.create({
      data: {
        listId: list.id,
        rawText: cp.name,
        canonicalProductId: canonIdBySlug.get(slug)!,
        categoryId: catIdBySlug.get(cp.category)!,
        quantity: qty,
        unit: cp.baseUnit,
        brandMode: pinnedBrand ? "pinned_brand" : "any",
        pinnedBrandId: pinnedBrand ? brandIdByName.get(pinnedBrand)! : null,
        position: pos++,
      },
    });
  }

  console.log(
    `Seed klaar: ${SUPERMARKETS.length} winkels · ${catNames.length} categorieën · ` +
      `${brandInfo.size} merken · ${CATALOG.length} producten · ${storeProductCount} winkelproducten · ` +
      `${promoIdByKey.size} acties. Demo-login: demo@korf.nl / demo1234`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
