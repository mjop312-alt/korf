// Eén crawl-ronde voor één winkel: crawlen → in bulk opslaan → verdwenen producten
// markeren → loggen in CrawlRun. Gedeeld door `npm run crawl` en `npm run worker`.

import type { PrismaClient } from "@prisma/client";
import { ahCrawler } from "./ah";
import { jumboCrawler } from "./jumbo";
import { lidlCrawler } from "./lidl";
import { markMissing, persistBatch, supermarketId } from "./store";
import type { CrawledProduct, Crawler, StoreSlug } from "./types";

export const CRAWLERS: Record<StoreSlug, Crawler> = { ah: ahCrawler, jumbo: jumboCrawler, lidl: lidlCrawler };
export const STORES = Object.keys(CRAWLERS) as StoreSlug[];

// Kleine pagina's (Jumbo: ~25) eerst opsparen: minder database-rondes.
const FLUSH_AT = 800;

export interface RunOptions {
  /** Stop na N producten (test); de ronde telt dan als "partial" en markeert niets als verdwenen. */
  limit?: number;
  /** Niets opslaan; producten verzamelen in `collect`. */
  dry?: boolean;
  collect?: CrawledProduct[];
  log?: (message: string) => void;
}

export interface RunResult {
  store: StoreSlug;
  ok: boolean;
  partial: boolean;
  products: number;
  created: number;
  changed: number;
  unchanged: number;
  promos: number;
  markedGone: number;
  durationMs: number;
  error?: string;
}

export async function crawlStore(db: PrismaClient, slug: StoreSlug, opts: RunOptions = {}): Promise<RunResult> {
  const t0 = Date.now();
  const started = new Date();
  const limit = opts.limit ?? Infinity;
  const log = opts.log ?? (() => {});
  const res: RunResult = {
    store: slug,
    ok: false,
    partial: false,
    products: 0,
    created: 0,
    changed: 0,
    unchanged: 0,
    promos: 0,
    markedGone: 0,
    durationMs: 0,
  };

  const smId = opts.dry ? "" : await supermarketId(db, slug);
  const run = opts.dry ? null : await db.crawlRun.create({ data: { store: slug, startedAt: started } });

  try {
    let buffer: CrawledProduct[] = [];
    let count = 0;
    const flush = async () => {
      if (!buffer.length) return;
      if (!opts.dry) {
        const s = await persistBatch(db, slug, smId, buffer, started);
        res.products += s.seen;
        res.created += s.created;
        res.changed += s.changed;
        res.unchanged += s.unchanged;
        res.promos += s.promos;
      }
      buffer = [];
    };

    const gen = CRAWLERS[slug].crawlAll({ log });
    for await (const batch of gen) {
      for (const p of batch) {
        if (count >= limit) break;
        count++;
        buffer.push(p);
        opts.collect?.push(p);
      }
      if (buffer.length >= FLUSH_AT) await flush();
      if (count >= limit) {
        res.partial = true;
        await gen.return(undefined);
        break;
      }
    }
    await flush();
    if (opts.dry) res.products = count;

    if (!opts.dry && !res.partial) {
      const m = await markMissing(db, smId, started, res.products);
      res.markedGone = m.marked;
      res.partial = m.skipped; // te weinig producten gezien ⇒ deze ronde is niet volledig
      await db.supermarket.update({ where: { id: smId }, data: { dataProvider: slug } });
    }
    res.ok = true;
  } catch (e) {
    res.error = e instanceof Error ? e.message : String(e);
  }

  res.durationMs = Date.now() - t0;
  if (run) {
    await db.crawlRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        ok: res.ok,
        partial: res.partial,
        products: res.products,
        created: res.created,
        changed: res.changed,
        unchanged: res.unchanged,
        promos: res.promos,
        markedGone: res.markedGone,
        durationMs: res.durationMs,
        error: res.error?.slice(0, 500) ?? null,
      },
    });
  }
  return res;
}
