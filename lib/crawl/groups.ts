// Koppelt winkelproducten aan productgroepen (CanonicalProduct) in de database.
// Een groep = alle merken + huismerken van hetzelfde soort product in dezelfde hoeveelheid,
// over alle winkels (zie group.ts voor de sleutel).

import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { CATEGORIES, groupFor, searchTextFor, type GroupInput } from "./group";

const newId = () => `c${randomUUID().replace(/-/g, "")}`;

let categoryIds: Map<string, string> | null = null;

/** Zorgt dat de eengemaakte categorieën bestaan en geeft slug → id terug (gecachet per proces). */
export async function ensureCategories(db: PrismaClient): Promise<Map<string, string>> {
  if (categoryIds) return categoryIds;
  await db.category.createMany({
    data: CATEGORIES.map((c) => ({ slug: c.slug, name: c.name })),
    skipDuplicates: true,
  });
  // bestaande categorieën (bv. uit de oude mockdata) kunnen dezelfde slug maar een andere naam hebben
  for (const c of CATEGORIES) await db.category.updateMany({ where: { slug: c.slug, NOT: { name: c.name } }, data: { name: c.name } });
  const rows = await db.category.findMany({ where: { slug: { in: CATEGORIES.map((c) => c.slug) } }, select: { id: true, slug: true } });
  categoryIds = new Map(rows.map((r) => [r.slug, r.id]));
  return categoryIds;
}

export interface LinkRow extends GroupInput {
  externalId: string;
  imageUrl: string | null;
}

/**
 * Bepaalt per product de groep, maakt ontbrekende groepen aan (eerste product bepaalt de
 * naam) en zet `matchKey` + `canonicalProductId` op de winkelproducten van deze winkel.
 */
export async function linkGroups(db: PrismaClient, supermarketId: string, rows: LinkRow[]): Promise<void> {
  if (!rows.length) return;
  const cats = await ensureCategories(db);
  const infos = rows.map((r) => groupFor(r));

  const groups = new Map<string, { info: (typeof infos)[number]; image: string | null }>();
  rows.forEach((r, i) => {
    const g = groups.get(infos[i].slug);
    if (!g) groups.set(infos[i].slug, { info: infos[i], image: r.imageUrl });
    else if (!g.image && r.imageUrl) g.image = r.imageUrl;
  });
  const list = [...groups.values()];

  await db.$executeRaw`
    INSERT INTO "CanonicalProduct" ("id","slug","name","categoryId","baseUnit","baseSize","imageUrl")
    SELECT t.id, t.slug, t.name, t.category_id, t.base_unit, t.base_size, t.image
    FROM unnest(
      ${list.map(() => newId())}::text[],
      ${list.map((g) => g.info.slug)}::text[],
      ${list.map((g) => g.info.name)}::text[],
      ${list.map((g) => cats.get(g.info.categorySlug)!)}::text[],
      ${list.map((g) => g.info.baseUnit)}::text[],
      ${list.map((g) => g.info.baseSize)}::float8[],
      ${list.map((g) => g.image)}::text[]
    ) AS t(id, slug, name, category_id, base_unit, base_size, image)
    ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = COALESCE("CanonicalProduct"."imageUrl", EXCLUDED."imageUrl")`;

  await db.$executeRaw`
    UPDATE "StoreProduct" sp
    SET "matchKey" = t.key, "canonicalProductId" = cp.id, "searchText" = t.search
    FROM unnest(
      ${rows.map((r) => r.externalId)}::text[],
      ${infos.map((i) => i.slug)}::text[],
      ${infos.map((i) => i.key)}::text[],
      ${rows.map((r) => searchTextFor(r.title, r.brand))}::text[]
    ) AS t(ext, slug, key, search)
    JOIN "CanonicalProduct" cp ON cp.slug = t.slug
    WHERE sp."supermarketId" = ${supermarketId}::text AND sp."externalId" = t.ext`;
}

/** Groepen zonder enig winkelproduct én zonder verwijzing (lijst/favoriet/alert) opruimen. */
export async function pruneEmptyGroups(db: PrismaClient): Promise<number> {
  return db.$executeRaw`
    DELETE FROM "CanonicalProduct" cp
    WHERE NOT EXISTS (SELECT 1 FROM "StoreProduct" sp WHERE sp."canonicalProductId" = cp.id)
      AND NOT EXISTS (SELECT 1 FROM "ShoppingListItem" li WHERE li."canonicalProductId" = cp.id)
      AND NOT EXISTS (SELECT 1 FROM "FavoriteProduct" f WHERE f."canonicalProductId" = cp.id)
      AND NOT EXISTS (SELECT 1 FROM "PriceAlert" a WHERE a."canonicalProductId" = cp.id)`;
}

/**
 * Voegt groepen samen die dezelfde EAN delen: dezelfde barcode is per definitie hetzelfde
 * product, ook als de winkels het anders noemen. Doel-groep = de groep met de alfabetisch
 * laagste slug (deterministisch, dus een volgende crawl schuift niets heen en weer).
 * Geeft het aantal verplaatste winkelproducten terug. Draai na een volledige crawl/regroup.
 */
export async function mergeByEan(db: PrismaClient): Promise<number> {
  const moved = await db.$executeRaw`
    WITH e AS (
      SELECT sp.ean, MIN(cp.slug) AS tslug
      FROM "StoreProduct" sp
      JOIN "CanonicalProduct" cp ON cp.id = sp."canonicalProductId"
      WHERE sp.ean IS NOT NULL AND sp.ean <> '' AND sp.available
      GROUP BY sp.ean
      HAVING COUNT(DISTINCT cp.id) > 1
    )
    UPDATE "StoreProduct" sp
    SET "canonicalProductId" = t.id
    FROM e JOIN "CanonicalProduct" t ON t.slug = e.tslug
    WHERE sp.ean = e.ean AND sp."canonicalProductId" <> t.id`;
  if (moved) await pruneEmptyGroups(db);
  return moved;
}
