// Status van de crawlers per winkel, uit het CrawlRun-logboek — voor de pagina Betrouwbaarheid.

import { db } from "./db";
import { STORES } from "./crawl/run";

export interface CrawlStatus {
  slug: string;
  name: string;
  products: number;
  lastFullLabel: string;
  fresh: boolean;
  note: string;
}

const NOTES: Record<string, string> = {
  ah: "volledige webshop-catalogus, incl. Bonus-acties",
  jumbo: "volledige webshop-catalogus, incl. acties met echte einddatum",
  lidl: "alleen wat Lidl.nl online toont (voedingsmiddelen); geen merk of EAN in de bron",
};

const NAMES: Record<string, string> = { ah: "Albert Heijn", jumbo: "Jumbo", lidl: "Lidl" };

function ago(d: Date): string {
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 2) return "zojuist";
  if (min < 90) return `${min} min geleden`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} uur geleden`;
  return `${Math.round(h / 24)} dagen geleden`;
}

export async function getCrawlStatus(): Promise<CrawlStatus[]> {
  const out: CrawlStatus[] = [];
  for (const slug of STORES) {
    const [count, last, lastAny] = await Promise.all([
      db.storeProduct.count({ where: { supermarket: { slug }, available: true, externalId: { not: null } } }),
      db.crawlRun.findFirst({ where: { store: slug, ok: true, partial: false }, orderBy: { startedAt: "desc" } }),
      db.crawlRun.findFirst({ where: { store: slug }, orderBy: { startedAt: "desc" } }),
    ]);
    const at = last?.finishedAt ?? last?.startedAt ?? null;
    const failing = lastAny && !lastAny.ok && (!last || lastAny.startedAt > last.startedAt);
    out.push({
      slug,
      name: NAMES[slug] ?? slug,
      products: count,
      lastFullLabel: at ? ago(at) : "nog nooit",
      fresh: !!at && !failing && Date.now() - at.getTime() < 3 * 3600_000,
      note: (NOTES[slug] ?? "") + (failing ? " — laatste poging mislukt" : ""),
    });
  }
  return out;
}
