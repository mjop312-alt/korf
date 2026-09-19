// Korf — verwijdert de oude MOCKDATA uit de database (eenmalig, idempotent).
//
//   npm run purge-mock
//
// Vroeger stond er een handgemaakte catalogus van 65 producten in (`lib/mock-data.ts`). Die
// rijen hebben geen `externalId` (echte crawl-producten wel) en kwamen naast de echte data te
// staan — en wonnen vaak omdat ze de goedkoopste waren. Dit ruimt op:
//   • winkelproducten zonder externalId (met hun prijzen en prijsgeschiedenis)
//   • mock-acties, en producten/merken/categorieën waar nu niets meer aan hangt
//
// Gebruikersdata (lijsten, favorieten, alerts) die naar oude mock-producten verwees kan niet
// meer kloppen; draai daarom eerst `npm run db:seed` (wist gebruikersdata en maakt een nieuwe
// demo-lijst) en daarna dit script — dan zijn er geen verwijzingen meer.

import { PrismaClient } from "@prisma/client";
import { CATEGORIES } from "../lib/crawl/group";
import { pruneEmptyGroups } from "../lib/crawl/groups";

const db = new PrismaClient();

async function count(label: string, table: string, where = "TRUE") {
  const [r] = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*)::int AS n FROM "${table}" WHERE ${where}`);
  console.log(`  ${label.padEnd(34)} ${r.n}`);
}

async function main() {
  console.log("Voor het opruimen:");
  await count("winkelproducten zonder externalId", "StoreProduct", `"externalId" IS NULL`);
  await count("winkelproducten (echt)", "StoreProduct", `"externalId" IS NOT NULL`);
  await count("productgroepen", "CanonicalProduct");
  await count("merken", "Brand");
  await count("categorieën", "Category");

  const sp = await db.storeProduct.deleteMany({ where: { externalId: null } });
  const promos = await db.$executeRaw`DELETE FROM "Promotion" WHERE NOT starts_with(id, 'pr_')`;
  const groups = await pruneEmptyGroups(db);
  const brands = await db.$executeRaw`
    DELETE FROM "Brand" b
    WHERE NOT EXISTS (SELECT 1 FROM "StoreProduct" sp WHERE sp."brandId" = b.id)
      AND NOT EXISTS (SELECT 1 FROM "CanonicalProduct" cp WHERE cp."typicalBrandId" = b.id)
      AND NOT EXISTS (SELECT 1 FROM "ShoppingListItem" li WHERE li."pinnedBrandId" = b.id)`;
  const keep = CATEGORIES.map((c) => c.slug);
  const cats = await db.$executeRaw`
    DELETE FROM "Category" c
    WHERE c.slug <> ALL(${keep}::text[])
      AND NOT EXISTS (SELECT 1 FROM "CanonicalProduct" cp WHERE cp."categoryId" = c.id)
      AND NOT EXISTS (SELECT 1 FROM "ShoppingListItem" li WHERE li."categoryId" = c.id)
      AND NOT EXISTS (SELECT 1 FROM "Category" ch WHERE ch."parentId" = c.id)`;

  console.log(
    `\nVerwijderd: ${sp.count} mock-winkelproducten · ${promos} mock-acties · ${groups} lege productgroepen · ` +
      `${brands} ongebruikte merken · ${cats} oude categorieën\n\nNa het opruimen:`,
  );
  await count("winkelproducten zonder externalId", "StoreProduct", `"externalId" IS NULL`);
  await count("winkelproducten (echt)", "StoreProduct", `"externalId" IS NOT NULL`);
  await count("productgroepen", "CanonicalProduct");
  await count("merken", "Brand");
  await count("categorieën", "Category");
}

main().finally(() => db.$disconnect());
