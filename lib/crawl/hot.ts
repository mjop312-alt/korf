// Snel verversen van de producten die er voor gebruikers toe doen: alles wat in een lijst
// (niet-gearchiveerd), favorieten of prijsalerts zit. De volledige ronde per winkel duurt 2–12
// minuten en draait op een rustiger ritme; dit werkt alleen de "hete" producten bij, per
// product één zoekopdracht, en past daardoor in een ritme van 5 minuten.
//
// Per productgroep en winkel nemen we de HOOGSTENS 3 goedkoopste varianten mee — dat zijn de
// prijzen waar de vergelijker op leunt.

import type { PrismaClient } from "@prisma/client";
import { CRAWLERS } from "./run";
import { persistBatch, supermarketId } from "./store";
import type { CrawledProduct, LookupItem, StoreSlug } from "./types";
import { sleep } from "./util";

export const HOT_PER_GROUP = 3;
const CONCURRENCY = 3;
const DELAY_MS = 150;

export interface HotResult {
  store: StoreSlug;
  candidates: number;
  found: number;
  missing: number;
  failed: number;
  created: number;
  changed: number;
  unchanged: number;
  promos: number;
  durationMs: number;
}

/** Winkels die een gerichte opzoek-functie hebben. */
export const HOT_STORES = (Object.keys(CRAWLERS) as StoreSlug[]).filter((s) => CRAWLERS[s].lookup);

export async function hotProducts(db: PrismaClient, store: StoreSlug, limit = 600): Promise<LookupItem[]> {
  return db.$queryRaw<LookupItem[]>`
    WITH refd AS (
      SELECT li."canonicalProductId" AS id
      FROM "ShoppingListItem" li JOIN "ShoppingList" l ON l.id = li."listId"
      WHERE li."canonicalProductId" IS NOT NULL AND l."archivedAt" IS NULL
      UNION SELECT "canonicalProductId" FROM "FavoriteProduct"
      UNION SELECT "canonicalProductId" FROM "PriceAlert"
    ), r AS (
      SELECT sp."externalId", sp.title, sp."categoryTop", sp."lastSeenAt",
             row_number() OVER (
               PARTITION BY sp."canonicalProductId"
               ORDER BY CASE WHEN pr."isPromo" AND pr."promoPriceCents" IS NOT NULL THEN pr."promoPriceCents" ELSE pr."priceCents" END
             ) AS rn
      FROM "StoreProduct" sp
      JOIN refd ON refd.id = sp."canonicalProductId"
      JOIN "Supermarket" s ON s.id = sp."supermarketId"
      JOIN "Price" pr ON pr."storeProductId" = sp.id
      WHERE s.slug = ${store} AND sp.available AND sp."externalId" IS NOT NULL
    )
    SELECT "externalId", title, "categoryTop" FROM r WHERE rn <= ${HOT_PER_GROUP}
    ORDER BY "lastSeenAt" ASC NULLS FIRST
    LIMIT ${limit}`;
}

/** Ververst de hete producten van één winkel. Gooit niet bij losse fouten per product. */
export async function refreshHot(
  db: PrismaClient,
  store: StoreSlug,
  opts: { limit?: number; dry?: boolean; log?: (m: string) => void } = {},
): Promise<HotResult> {
  const t0 = Date.now();
  const crawler = CRAWLERS[store];
  const res: HotResult = { store, candidates: 0, found: 0, missing: 0, failed: 0, created: 0, changed: 0, unchanged: 0, promos: 0, durationMs: 0 };
  if (!crawler.lookup) return res;

  const items = await hotProducts(db, store, opts.limit);
  res.candidates = items.length;
  const got: CrawledProduct[] = [];
  let next = 0;
  let firstError = "";

  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      try {
        const p = await crawler.lookup!(item);
        if (p) got.push(p);
        else res.missing++;
      } catch (e) {
        res.failed++;
        firstError ||= e instanceof Error ? e.message : String(e);
        // de winkel blokkeert of de API is stuk: niet doorhameren
        if (res.failed >= 10 && res.failed > items.length * 0.3) {
          next = items.length;
          opts.log?.(`${store}: te veel fouten, gestopt (${firstError})`);
        }
      }
      await sleep(DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  res.found = got.length;
  if (got.length && !opts.dry) {
    const smId = await supermarketId(db, store);
    const s = await persistBatch(db, store, smId, got);
    res.created = s.created;
    res.changed = s.changed;
    res.unchanged = s.unchanged;
    res.promos = s.promos;
  }
  res.durationMs = Date.now() - t0;
  return res;
}
