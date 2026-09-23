// Zoeken en bladeren door de volledige catalogus (tienduizenden producten, gegroepeerd in
// productgroepen). Server-kant; neemt `db` als parameter zodat scripts (seed) het ook kunnen
// gebruiken. Zoeken werkt op `StoreProduct.searchText` (accent-vrij, titel + merk) en telt
// per groep: in hoeveel winkels, hoeveel producten/merken, en de laagste prijs.

import { Prisma, type PrismaClient } from "@prisma/client";
import { isSizeToken, searchTerms } from "./crawl/group";
import { parsePack } from "./crawl/util";

export interface SearchOptions {
  q?: string;
  /** winkel-slugs (ah | jumbo | lidl | aldi | plus) — leeg/weggelaten ⇒ alle winkels */
  stores?: string[];
  /** categorie-slug */
  category?: string;
  /** exacte merknaam (hoofdletterongevoelig) */
  brand?: string;
  /** a = alleen A-merken, own = alleen huismerken */
  kind?: "a" | "own";
  /** alleen producten met een lopende aanbieding */
  promo?: boolean;
  /** alleen groepen die in minstens zoveel winkels te koop zijn */
  minStores?: number;
  sort?: "relevance" | "price" | "stores";
  page?: number;
  pageSize?: number;
}

export interface StorePrice {
  store: string;
  cents: number;
  regularCents: number;
  promo: boolean;
  brand: string;
  ownBrand: boolean;
  title: string;
}

export interface GroupCard {
  slug: string;
  name: string;
  category: string;
  imageUrl: string | null;
  stores: StorePrice[];
  products: number;
  brands: number;
}

// effectieve prijs = actieprijs als de actie nog loopt, anders de schapprijs
const EFFECTIVE = Prisma.sql`CASE WHEN pr."isPromo" AND pr."promoPriceCents" IS NOT NULL AND (pm."endsAt" IS NULL OR pm."endsAt" >= now())
  THEN pr."promoPriceCents" ELSE pr."priceCents" END`;
const PROMO_ACTIVE = Prisma.sql`(pr."isPromo" AND (pm."endsAt" IS NULL OR pm."endsAt" >= now()))`;

const FROM = Prisma.sql`
  FROM "StoreProduct" sp
  JOIN "Supermarket" s ON s.id = sp."supermarketId"
  JOIN "Brand" b ON b.id = sp."brandId"
  JOIN "CanonicalProduct" cp ON cp.id = sp."canonicalProductId"
  JOIN "Category" c ON c.id = cp."categoryId"
  JOIN "Price" pr ON pr."storeProductId" = sp.id
  LEFT JOIN "Promotion" pm ON pm.id = pr."promotionId"`;

/** Zoekwoorden zonder groottes ('1', 'l', '500g'). */
function words(q: string | undefined): string[] {
  return searchTerms(q ?? "").filter((t) => !isSizeToken(t));
}

function filters(o: SearchOptions, withText: boolean): Prisma.Sql[] {
  const c: Prisma.Sql[] = [Prisma.sql`sp.available AND sp."externalId" IS NOT NULL`];
  if (withText) {
    for (const t of words(o.q)) c.push(Prisma.sql`sp."searchText" LIKE ${"%" + t + "%"}`);
    // "1 l" / "500 g" in de zoekterm is een filter op verpakking, geen woord in de titel
    const pack = parsePack(o.q);
    if (pack) {
      c.push(Prisma.sql`cp."baseUnit" = ${pack.unit} AND abs(cp."baseSize" - ${pack.size}) <= ${pack.size * 0.02}`);
    }
  }
  if (o.stores?.length) c.push(Prisma.sql`s.slug = ANY(${o.stores}::text[])`);
  if (o.category) c.push(Prisma.sql`c.slug = ${o.category}`);
  if (o.brand) c.push(Prisma.sql`lower(b.name) = lower(${o.brand})`);
  if (o.kind === "own") c.push(Prisma.sql`b."isOwnBrand"`);
  if (o.kind === "a") c.push(Prisma.sql`NOT b."isOwnBrand"`);
  if (o.promo) c.push(Prisma.sql`${PROMO_ACTIVE}`);
  return c;
}

export async function searchGroups(
  db: PrismaClient,
  o: SearchOptions = {},
): Promise<{ total: number; page: number; pageSize: number; cards: GroupCard[] }> {
  const pageSize = Math.min(Math.max(o.pageSize ?? 24, 1), 60);
  const page = Math.max(o.page ?? 1, 1);
  const where = Prisma.join(filters(o, true), " AND ");
  const minStores = Math.max(o.minStores ?? 1, 1);
  const ws = words(o.q);
  const nameHit = ws.length
    ? Prisma.sql`CASE WHEN ${Prisma.join(
        ws.map((t) => Prisma.sql`lower(cp2.name) ~ ${"(^| )" + t.replace(/[^a-z0-9]/g, "") + "( |$)"}`),
        " AND ",
      )} THEN 0 ELSE 1 END`
    : Prisma.sql`0::int`; // niet kaal "0": ORDER BY 0 is een kolomnummer
  const order =
    o.sort === "price"
      ? Prisma.sql`g.min_cents ASC, g.stores DESC`
      : Prisma.sql`${nameHit} ASC, g.stores DESC, g.products DESC, length(cp2.name) ASC, cp2.name ASC`;

  const ids = await db.$queryRaw<{ gid: string; products: number; brands: number; total: number }[]>`
    SELECT g.gid, g.products, g.brands, (COUNT(*) OVER())::int AS total
    FROM (
      SELECT sp."canonicalProductId" AS gid,
             COUNT(DISTINCT s.id)::int AS stores, COUNT(*)::int AS products, COUNT(DISTINCT b.id)::int AS brands,
             MIN(${EFFECTIVE}) AS min_cents
      ${FROM}
      WHERE ${where}
      GROUP BY sp."canonicalProductId"
      HAVING COUNT(DISTINCT s.id) >= ${minStores}
    ) g
    JOIN "CanonicalProduct" cp2 ON cp2.id = g.gid
    ORDER BY ${order}
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;

  if (!ids.length) return { total: 0, page, pageSize, cards: [] };
  const gids = ids.map((r) => r.gid);
  const detailWhere = Prisma.join([...filters(o, false), Prisma.sql`sp."canonicalProductId" = ANY(${gids}::text[])`], " AND ");

  const rows = await db.$queryRaw<
    {
      gid: string;
      slug: string;
      name: string;
      category: string;
      group_image: string | null;
      store: string;
      title: string;
      brand: string;
      own: boolean;
      image: string | null;
      cents: number;
      regular: number;
      promo: boolean;
    }[]
  >`
    SELECT DISTINCT ON (sp."canonicalProductId", s.slug)
      sp."canonicalProductId" AS gid, cp.slug, cp.name, c.name AS category, cp."imageUrl" AS group_image,
      s.slug AS store, sp.title, b.name AS brand, b."isOwnBrand" AS own, sp."imageUrl" AS image,
      ${EFFECTIVE} AS cents, pr."priceCents" AS regular, ${PROMO_ACTIVE} AS promo
    ${FROM}
    WHERE ${detailWhere}
    ORDER BY sp."canonicalProductId", s.slug, ${EFFECTIVE} ASC`;

  const byGid = new Map<string, GroupCard>();
  for (const r of rows) {
    let card = byGid.get(r.gid);
    if (!card) {
      const meta = ids.find((i) => i.gid === r.gid)!;
      card = {
        slug: r.slug,
        name: r.name,
        category: r.category,
        imageUrl: r.group_image ?? r.image,
        stores: [],
        products: meta.products,
        brands: meta.brands,
      };
      byGid.set(r.gid, card);
    }
    if (!card.imageUrl && r.image) card.imageUrl = r.image;
    card.stores.push({
      store: r.store,
      cents: r.cents,
      regularCents: r.regular,
      promo: r.promo,
      brand: r.brand,
      ownBrand: r.own,
      title: r.title,
    });
  }
  const cards = gids.map((g) => byGid.get(g)).filter((c): c is GroupCard => !!c);
  // één A-merk in de groep ⇒ dat merk in de naam (zie ook loadGroups in catalog-db.ts)
  for (const c of cards) {
    const first = c.stores[0];
    if (c.brands === 1 && first && !first.ownBrand && !c.name.toLowerCase().includes(first.brand.toLowerCase())) {
      c.name = `${first.brand} ${c.name}`;
    }
  }
  return { total: ids[0].total, page, pageSize, cards };
}

/** Beste groep voor een zoekterm (voor sjablonen/voorbeeldlijsten): liefst in ≥ 2 winkels. */
export async function findGroupSlug(db: PrismaClient, term: string, opts: SearchOptions = {}): Promise<string | null> {
  for (const minStores of [2, 1]) {
    const r = await searchGroups(db, { ...opts, q: term, minStores, pageSize: 1 });
    if (r.cards[0]) return r.cards[0].slug;
  }
  return null;
}

export interface CategoryFacet {
  slug: string;
  name: string;
  groups: number;
}

export async function listCategories(db: PrismaClient): Promise<CategoryFacet[]> {
  return db.$queryRaw<CategoryFacet[]>`
    SELECT c.slug, c.name, COUNT(DISTINCT cp.id)::int AS groups
    FROM "Category" c
    JOIN "CanonicalProduct" cp ON cp."categoryId" = c.id
    JOIN "StoreProduct" sp ON sp."canonicalProductId" = cp.id AND sp.available AND sp."externalId" IS NOT NULL
    GROUP BY c.slug, c.name ORDER BY groups DESC`;
}

/** Meest voorkomende merken binnen een zoekopdracht — voor een merkfilter. */
export async function topBrands(db: PrismaClient, o: SearchOptions = {}, limit = 12): Promise<{ name: string; products: number }[]> {
  const where = Prisma.join(filters({ ...o, brand: undefined }, true), " AND ");
  return db.$queryRaw<{ name: string; products: number }[]>`
    SELECT b.name, COUNT(*)::int AS products
    ${FROM}
    WHERE ${where}
    GROUP BY b.name ORDER BY products DESC, b.name ASC LIMIT ${limit}`;
}
