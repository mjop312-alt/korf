// Korf — seed. Zet de winkels, filialen en categorieën neer en maakt een demo-account met een
// voorbeeldlijst van ECHTE producten uit de catalogus. Idempotent.
//
//   npm run db:seed      (of: npm run db:reset  om het schema leeg te maken en opnieuw te seeden)
//
// LET OP: dit wist alleen GEBRUIKERSDATA (accounts, lijsten, alerts, favorieten). De catalogus
// (winkelproducten, prijzen, acties, groepen) komt uit de crawler — `npm run crawl` — en blijft
// staan. Na `db:reset` (dat alles wist) dus eerst opnieuw crawlen om de demo-lijst te vullen.
//
// Demo-login:  demo@korf.nl / demo1234

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { findGroupSlug } from "../lib/catalog-search";
import { ensureCategories } from "../lib/crawl/groups";
import { STORES as SUPERMARKETS } from "../lib/stores";

const db = new PrismaClient();

const DEMO_LIST: [string, number][] = [
  ["halfvolle melk 1 l", 2],
  ["brood", 1],
  ["koffie 500 g", 1],
  ["pindakaas 350 g", 1],
  ["yoghurt 1 l", 1],
];

async function wipeUserData() {
  // volgorde: kinderen eerst
  await db.shoppingListItem.deleteMany();
  await db.listShare.deleteMany();
  await db.savingsRecord.deleteMany();
  await db.shoppingList.deleteMany();
  await db.priceAlert.deleteMany();
  await db.favoriteProduct.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.userPreference.deleteMany();
  await db.user.deleteMany();
}

async function main() {
  await wipeUserData();

  // ── supermarkten (bijwerken, nooit wissen: de catalogus hangt eraan) ──
  const storeIdBySlug = new Map<string, string>();
  for (const s of SUPERMARKETS) {
    const row = await db.supermarket.upsert({
      where: { slug: s.id },
      update: { name: s.name, short: s.short, brandColor: s.brandColor },
      create: { slug: s.id, name: s.name, short: s.short, brandColor: s.brandColor, hasOnlineCatalogue: true, dataProvider: s.id },
    });
    storeIdBySlug.set(s.id, row.id);
  }

  // ── één filiaal per winkel (Amsterdam-centrum, fictief) ──
  const AMS: Record<string, [number, number]> = {
    ah: [52.372, 4.892],
    jumbo: [52.366, 4.9],
    lidl: [52.378, 4.9],
    aldi: [52.374, 4.905],
    plus: [52.369, 4.888],
  };
  await db.storeLocation.deleteMany();
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

  const cats = await ensureCategories(db);

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

  // ── demo-lijst uit echte producten ──
  let position = 0;
  for (const [term, quantity] of DEMO_LIST) {
    const slug = await findGroupSlug(db, term);
    const group = slug ? await db.canonicalProduct.findUnique({ where: { slug } }) : null;
    if (!group) continue;
    await db.shoppingListItem.create({
      data: {
        listId: list.id,
        rawText: group.name,
        canonicalProductId: group.id,
        categoryId: group.categoryId,
        quantity,
        unit: group.baseUnit,
        position: position++,
      },
    });
  }

  const [products] = await db.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "StoreProduct" WHERE "externalId" IS NOT NULL`;
  console.log(
    `Seed klaar: ${SUPERMARKETS.length} winkels · ${cats.size} categorieën · demo-lijst met ${position} producten · ` +
      `catalogus: ${products.n} producten. Demo-login: demo@korf.nl / demo1234`,
  );
  if (products.n === 0) console.log("De catalogus is leeg — draai `npm run crawl` en daarna nog eens `npm run db:seed`.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
