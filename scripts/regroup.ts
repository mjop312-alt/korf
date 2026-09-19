// Korf — indeling in productgroepen opnieuw berekenen voor ALLE opgeslagen winkelproducten.
//
//   npm run regroup           opnieuw indelen + statistieken
//   npm run regroup -- --stats   alleen statistieken
//
// Geen netwerk nodig (alles komt uit de database), dus handig om de groepering af te
// stellen (lib/crawl/group.ts) zonder opnieuw te crawlen. De crawler doet hetzelfde per
// batch voor nieuwe/gewijzigde producten.

import { PrismaClient } from "@prisma/client";
import { linkGroups, mergeByEan, pruneEmptyGroups } from "../lib/crawl/groups";

const db = new PrismaClient();
const statsOnly = process.argv.includes("--stats");
const CHUNK = 2000;

async function regroup() {
  const stores = await db.supermarket.findMany({ select: { id: true, slug: true } });
  for (const sm of stores) {
    const t0 = Date.now();
    let done = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows = await db.storeProduct.findMany({
        where: { supermarketId: sm.id, externalId: { not: null } },
        orderBy: { id: "asc" },
        take: CHUNK,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          externalId: true,
          title: true,
          packLabel: true,
          categoryTop: true,
          imageUrl: true,
          brand: { select: { name: true, isOwnBrand: true } },
        },
      });
      if (!rows.length) break;
      await linkGroups(
        db,
        sm.id,
        rows.map((r) => ({
          externalId: r.externalId!,
          title: r.title,
          brand: r.brand.name,
          ownBrand: r.brand.isOwnBrand,
          packLabel: r.packLabel,
          categoryTop: r.categoryTop,
          imageUrl: r.imageUrl,
        })),
      );
      done += rows.length;
      cursor = rows[rows.length - 1].id;
    }
    console.log(`  ${sm.slug}: ${done} producten ingedeeld (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  console.log(`  ${await pruneEmptyGroups(db)} lege groepen opgeruimd`);
  console.log(`  ${await mergeByEan(db)} winkelproducten samengevoegd op EAN`);
}

async function stats() {
  const [tot] = await db.$queryRaw<{ producten: number; gegroepeerd: number; groepen: number }[]>`
    SELECT COUNT(*)::int AS producten,
           COUNT("canonicalProductId")::int AS gegroepeerd,
           COUNT(DISTINCT "canonicalProductId")::int AS groepen
    FROM "StoreProduct" WHERE "externalId" IS NOT NULL`;
  console.log(`\nProducten: ${tot.producten} · in een groep: ${tot.gegroepeerd} · groepen: ${tot.groepen}`);

  const spread = await db.$queryRaw<{ winkels: number; groepen: number; producten: number }[]>`
    SELECT n AS winkels, COUNT(*)::int AS groepen, SUM(p)::int AS producten FROM (
      SELECT sp."canonicalProductId", COUNT(DISTINCT sp."supermarketId")::int AS n, COUNT(*)::int AS p
      FROM "StoreProduct" sp WHERE sp."externalId" IS NOT NULL AND sp."canonicalProductId" IS NOT NULL
      GROUP BY sp."canonicalProductId") g
    GROUP BY n ORDER BY n`;
  console.log("Groepen naar aantal winkels waar ze te koop zijn:");
  for (const s of spread) console.log(`  in ${s.winkels} winkel(s): ${s.groepen} groepen (${s.producten} producten)`);

  const big = await db.$queryRaw<{ name: string; winkels: number; producten: number; merken: number }[]>`
    SELECT cp.name, COUNT(DISTINCT sp."supermarketId")::int AS winkels, COUNT(*)::int AS producten,
           COUNT(DISTINCT sp."brandId")::int AS merken
    FROM "StoreProduct" sp JOIN "CanonicalProduct" cp ON cp.id = sp."canonicalProductId"
    WHERE sp."externalId" IS NOT NULL
    GROUP BY cp.id, cp.name HAVING COUNT(DISTINCT sp."supermarketId") >= 3
    ORDER BY COUNT(*) DESC LIMIT 8`;
  console.log("\nGrootste groepen in alle winkels:");
  for (const g of big) console.log(`  ${g.name.padEnd(46)} ${g.winkels} winkels · ${g.producten} producten · ${g.merken} merken`);

  const cats = await db.$queryRaw<{ name: string; groepen: number }[]>`
    SELECT c.name, COUNT(*)::int AS groepen FROM "CanonicalProduct" cp JOIN "Category" c ON c.id = cp."categoryId"
    WHERE EXISTS (SELECT 1 FROM "StoreProduct" sp WHERE sp."canonicalProductId" = cp.id AND sp."externalId" IS NOT NULL)
    GROUP BY c.name ORDER BY groepen DESC`;
  console.log("\nGroepen per categorie: " + cats.map((c) => `${c.name} ${c.groepen}`).join(" · "));
}

async function main() {
  if (!statsOnly) {
    console.log("Opnieuw indelen…");
    await regroup();
  }
  await stats();
}

main().finally(() => db.$disconnect());
