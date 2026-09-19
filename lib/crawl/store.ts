// Schrijft crawler-batches in bulk naar de database (INSERT … ON CONFLICT via unnest).
//
// - StoreProduct: upsert op (supermarketId, externalId)
// - Price: alleen herschreven als er iets veranderde; onveranderde prijzen krijgen enkel
//   een nieuwe `collectedAt` ("bevestigd op …")
// - PriceHistory: alleen bij een wijziging (anders loopt de database vol)
// - Promotion: deterministisch id ⇒ dezelfde actie wordt nooit dubbel opgeslagen

import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { CrawledProduct, StoreSlug } from "./types";
import { parsePack, weekEnd } from "./util";

export interface PersistStats {
  seen: number;
  created: number;
  changed: number;
  unchanged: number;
  promos: number;
}

const newId = () => `c${randomUUID().replace(/-/g, "")}`;

export async function supermarketId(db: PrismaClient, slug: StoreSlug): Promise<string> {
  const s = await db.supermarket.findUnique({ where: { slug }, select: { id: true } });
  if (!s) throw new Error(`Supermarkt "${slug}" staat niet in de database — draai eerst de seed.`);
  return s.id;
}

function promoId(store: string, p: NonNullable<CrawledProduct["promo"]>, ends: Date): string {
  const h = createHash("sha1")
    .update(`${p.label}|${p.startsAt?.toISOString() ?? ""}|${ends.toISOString()}|${p.priceCents == null ? "l" : "p"}`)
    .digest("hex")
    .slice(0, 16);
  return `pr_${store}_${h}`;
}

export async function persistBatch(
  db: PrismaClient,
  store: StoreSlug,
  smId: string,
  products: CrawledProduct[],
  now = new Date(),
): Promise<PersistStats> {
  // dubbele externalId's in één batch geven een Postgres-fout bij ON CONFLICT
  const byExt = new Map<string, CrawledProduct>();
  for (const p of products) byExt.set(p.externalId, p);
  const items = [...byExt.values()];
  const stats: PersistStats = { seen: items.length, created: 0, changed: 0, unchanged: 0, promos: 0 };
  if (!items.length) return stats;

  const nowIso = now.toISOString();

  // 1 — merken
  const ownByName = new Map<string, boolean>();
  for (const p of items) ownByName.set(p.brand, (ownByName.get(p.brand) ?? false) || p.ownBrand);
  const brandNames = [...ownByName.keys()];
  await db.brand.createMany({
    data: brandNames.map((name) => ({ name, isOwnBrand: ownByName.get(name)! })),
    skipDuplicates: true,
  });
  const brandRows = await db.brand.findMany({
    where: { name: { in: brandNames } },
    select: { id: true, name: true, isOwnBrand: true },
  });
  const brandId = new Map(brandRows.map((b) => [b.name, b.id]));
  const shouldBeOwn = brandRows.filter((b) => ownByName.get(b.name) && !b.isOwnBrand).map((b) => b.id);
  if (shouldBeOwn.length) await db.brand.updateMany({ where: { id: { in: shouldBeOwn } }, data: { isOwnBrand: true } });

  // 2 — winkelproducten
  const packs = items.map((p) => parsePack(p.packLabel));
  const rows = await db.$queryRaw<{ id: string; externalId: string }[]>`
    INSERT INTO "StoreProduct"
      ("id","supermarketId","brandId","title","ean","packSize","packUnit","externalId","externalUrl","imageUrl",
       "available","categoryTop","categoryPath","packLabel","lastSeenAt")
    SELECT t.id, ${smId}::text, t.brand_id, t.title, t.ean, t.pack_size, t.pack_unit, t.external_id, t.url, t.image,
           t.available, t.cat_top, t.cat_path, t.pack_label, ${nowIso}::timestamp
    FROM unnest(
      ${items.map(() => newId())}::text[],
      ${items.map((p) => brandId.get(p.brand)!)}::text[],
      ${items.map((p) => p.title)}::text[],
      ${items.map((p) => p.ean)}::text[],
      ${packs.map((k) => k?.size ?? null)}::float8[],
      ${packs.map((k) => k?.unit ?? null)}::text[],
      ${items.map((p) => p.externalId)}::text[],
      ${items.map((p) => p.url)}::text[],
      ${items.map((p) => p.imageUrl)}::text[],
      ${items.map((p) => p.available)}::bool[],
      ${items.map((p) => p.categoryTop)}::text[],
      ${items.map((p) => p.categoryPath)}::text[],
      ${items.map((p) => p.packLabel)}::text[]
    ) AS t(id, brand_id, title, ean, pack_size, pack_unit, external_id, url, image,
           available, cat_top, cat_path, pack_label)
    ON CONFLICT ("supermarketId","externalId") DO UPDATE SET
      "brandId" = EXCLUDED."brandId",
      "title" = EXCLUDED."title",
      "ean" = COALESCE(EXCLUDED."ean", "StoreProduct"."ean"),
      "packSize" = EXCLUDED."packSize",
      "packUnit" = EXCLUDED."packUnit",
      "externalUrl" = EXCLUDED."externalUrl",
      "imageUrl" = EXCLUDED."imageUrl",
      "available" = EXCLUDED."available",
      "categoryTop" = EXCLUDED."categoryTop",
      "categoryPath" = EXCLUDED."categoryPath",
      "packLabel" = EXCLUDED."packLabel",
      "lastSeenAt" = EXCLUDED."lastSeenAt"
    RETURNING "id", "externalId"`;
  const spId = new Map(rows.map((r) => [r.externalId, r.id]));

  // 3 — acties (deterministisch id ⇒ idempotent)
  const fallbackEnd = weekEnd(now);
  const promoRows = new Map<string, { mechanism: string; label: string; starts: Date; ends: Date }>();
  const promoOf = new Map<string, string>(); // externalId → promotionId
  for (const p of items) {
    if (!p.promo) continue;
    const ends = p.promo.endsAt ?? fallbackEnd;
    const id = promoId(store, p.promo, ends);
    promoOf.set(p.externalId, id);
    promoRows.set(id, {
      mechanism: p.promo.priceCents != null ? "price_off" : "x_for_y",
      label: p.promo.label,
      starts: p.promo.startsAt ?? new Date(ends.getTime() - 7 * 86_400_000),
      ends,
    });
  }
  if (promoRows.size) {
    const list = [...promoRows];
    await db.$executeRaw`
      INSERT INTO "Promotion" ("id","supermarketId","mechanism","label","startsAt","endsAt","autoApplied")
      SELECT t.id, ${smId}::text, t.mechanism, t.label, t.starts, t.ends, t.auto
      FROM unnest(
        ${list.map(([id]) => id)}::text[],
        ${list.map(([, r]) => r.mechanism)}::text[],
        ${list.map(([, r]) => r.label)}::text[],
        ${list.map(([, r]) => r.starts.toISOString())}::timestamp[],
        ${list.map(([, r]) => r.ends.toISOString())}::timestamp[],
        ${list.map(([, r]) => r.mechanism === "price_off")}::bool[]
      ) AS t(id, mechanism, label, starts, ends, auto)
      ON CONFLICT ("id") DO UPDATE SET
        "label" = EXCLUDED."label", "startsAt" = EXCLUDED."startsAt", "endsAt" = EXCLUDED."endsAt"`;
    stats.promos = promoRows.size;
  }

  // 4 — prijzen: wat is nieuw / gewijzigd / ongewijzigd?
  const ids = items.map((p) => spId.get(p.externalId)!);
  const existing = await db.price.findMany({
    where: { storeProductId: { in: ids } },
    select: { storeProductId: true, priceCents: true, unitPriceCents: true, isPromo: true, promoPriceCents: true, promotionId: true },
  });
  const oldPrice = new Map(existing.map((e) => [e.storeProductId, e]));

  interface NewPrice {
    spId: string;
    price: number;
    unit: number | null;
    isPromo: boolean;
    promoPrice: number | null;
    promotionId: string | null;
  }
  const write: NewPrice[] = [];
  const touch: string[] = [];
  items.forEach((p, i) => {
    const id = ids[i];
    const promoPrice = p.promo?.priceCents ?? null;
    const pack = packs[i];
    // eenheidsprijs hoort bij de schapprijs (zoals de winkels 'm zelf tonen); ontbreekt hij,
    // leid 'm dan af uit schapprijs ÷ verpakkingsgrootte
    const unit = p.unitPriceCents ?? (pack && pack.size > 0 ? Math.round(p.priceCents / pack.size) : null);
    const next: NewPrice = {
      spId: id,
      price: p.priceCents,
      unit,
      isPromo: !!p.promo,
      promoPrice,
      promotionId: promoOf.get(p.externalId) ?? null,
    };
    const old = oldPrice.get(id);
    if (!old) {
      stats.created++;
      write.push(next);
    } else if (
      old.priceCents !== next.price ||
      old.unitPriceCents !== next.unit ||
      old.isPromo !== next.isPromo ||
      old.promoPriceCents !== next.promoPrice ||
      old.promotionId !== next.promotionId
    ) {
      stats.changed++;
      write.push(next);
    } else {
      stats.unchanged++;
      touch.push(id);
    }
  });

  if (write.length) {
    await db.$executeRaw`
      INSERT INTO "Price" ("storeProductId","priceCents","unitPriceCents","isPromo","promoPriceCents","promotionId","source","collectedAt")
      SELECT t.sp, t.price, t.unit, t.is_promo, t.promo_price, t.promotion_id, 'unofficial_api', ${nowIso}::timestamp
      FROM unnest(
        ${write.map((w) => w.spId)}::text[],
        ${write.map((w) => w.price)}::int[],
        ${write.map((w) => w.unit)}::int[],
        ${write.map((w) => w.isPromo)}::bool[],
        ${write.map((w) => w.promoPrice)}::int[],
        ${write.map((w) => w.promotionId)}::text[]
      ) AS t(sp, price, unit, is_promo, promo_price, promotion_id)
      ON CONFLICT ("storeProductId") DO UPDATE SET
        "priceCents" = EXCLUDED."priceCents",
        "unitPriceCents" = EXCLUDED."unitPriceCents",
        "isPromo" = EXCLUDED."isPromo",
        "promoPriceCents" = EXCLUDED."promoPriceCents",
        "promotionId" = EXCLUDED."promotionId",
        "source" = EXCLUDED."source",
        "collectedAt" = EXCLUDED."collectedAt"`;

    await db.$executeRaw`
      INSERT INTO "PriceHistory" ("id","storeProductId","priceCents","promoPriceCents","observedAt")
      SELECT t.id, t.sp, t.price, t.promo_price, ${nowIso}::timestamp
      FROM unnest(
        ${write.map(() => newId())}::text[],
        ${write.map((w) => w.spId)}::text[],
        ${write.map((w) => w.price)}::int[],
        ${write.map((w) => w.promoPrice)}::int[]
      ) AS t(id, sp, price, promo_price)`;
  }
  if (touch.length) {
    await db.$executeRaw`
      UPDATE "Price" SET "collectedAt" = ${nowIso}::timestamp, "source" = 'unofficial_api'
      WHERE "storeProductId" = ANY(${touch}::text[])`;
  }

  return stats;
}

/**
 * Na een VOLLEDIGE, geslaagde ronde: producten die niet meer voorbijkwamen zijn uit het
 * assortiment gehaald. Alleen als de ronde een plausibel aantal producten opleverde,
 * zodat een half mislukte crawl niet de hele catalogus "uitzet".
 */
export async function markMissing(
  db: PrismaClient,
  smId: string,
  crawlStartedAt: Date,
  seenCount: number,
): Promise<{ marked: number; skipped: boolean }> {
  const before = await db.storeProduct.count({ where: { supermarketId: smId, externalId: { not: null }, available: true } });
  if (before > 0 && seenCount < before * 0.7) return { marked: 0, skipped: true };
  const r = await db.storeProduct.updateMany({
    where: { supermarketId: smId, externalId: { not: null }, available: true, lastSeenAt: { lt: crawlStartedAt } },
    data: { available: false },
  });
  return { marked: r.count, skipped: false };
}
