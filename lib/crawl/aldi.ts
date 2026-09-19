// Aldi — de webshop-pagina's van aldi.nl bevatten per (sub)categorie de complete lijst uit hun
// Algolia-index (hitsPerPage 1000) als server-side data (`__NEXT_DATA__`). We lezen alle
// tweede-niveau-categoriepagina's en ontdubbelen op objectID (een product staat in meerdere
// categorieën). Geen API-sleutel nodig, geen EAN. Aldi.nl toont ruim 1.700 producten.

import type { CrawledProduct, CrawlOptions, Crawler } from "./types";
import { parsePack, sleep, USER_AGENT, weekEnd } from "./util";

const BASE = "https://www.aldi.nl";
const DELAY_MS = 400;

export interface AldiHit {
  objectID?: string;
  name?: string;
  brandName?: string;
  isAvailable?: boolean;
  shortDescription?: string;
  salesUnit?: string;
  productSlug?: string;
  currentPrice?: { priceValue?: number };
  promotionPrices?: {
    validFrom?: number;
    validUntil?: number;
    priceValue?: number;
    strikePrice?: { strikePriceValue?: number };
    priceTagLabels?: { promoText1?: string };
  }[];
  hierarchicalCategories?: { lvl0?: string[]; lvl1?: string[] };
  assets?: { type?: string; url?: string }[];
}

/** "MILSANI" → "Milsani", "coca-cola" blijft; alleen HOOFDLETTERS worden herschreven. */
export function niceBrand(b: string): string {
  const t = b.trim();
  if (!t) return "Aldi";
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s\-'])([a-zà-ÿ])/g, (_, s, c) => s + c.toUpperCase());
}

const NON_TOP = /^(speciaal assortiment|aldi merken|winnaarsproducten|nieuw|sintassortiment)/i;

export function mapAldi(h: AldiHit, now = new Date()): CrawledProduct | null {
  if (!h.objectID || !h.name || h.isAvailable === false) return null;

  const t = now.getTime() / 1000;
  const promo = (h.promotionPrices ?? []).find(
    (p) => typeof p.priceValue === "number" && (p.validFrom ?? 0) <= t && t <= (p.validUntil ?? Infinity),
  );
  const label = promo?.priceTagLabels?.promoText1?.trim() ?? "";
  // "2 VOOR" 2,50 = totaalprijs voor 2 stuks
  const multi = /^(\d+)\s*voor/i.exec(label);
  const n = multi ? parseInt(multi[1], 10) : 1;

  const strike = promo?.strikePrice?.strikePriceValue;
  const regular = h.currentPrice?.priceValue ?? (strike != null ? strike / n : undefined);
  if (regular == null || !(regular > 0)) return null;
  const promoUnit = promo?.priceValue != null ? promo.priceValue / n : null;
  const hasPromo = promoUnit != null && promoUnit < regular - 0.004;

  const lvl0 = h.hierarchicalCategories?.lvl0 ?? [];
  const lvl1 = h.hierarchicalCategories?.lvl1 ?? [];
  const noBrand = !(h.brandName ?? "").trim(); // zonder merk: gewoon een Aldi-product
  const ownBrand = noBrand || (lvl0.some((c) => /aldi merken/i.test(c)) && !lvl1.some((c) => /a-merken/i.test(c)));
  const brand = niceBrand(h.brandName ?? "");
  const name = h.name.trim();
  // Eigen merken (Milsani, Choceur…) heten per winkel anders; de kern van de titel is wat we matchen
  const title = ownBrand || !brand || name.toLowerCase().startsWith(brand.toLowerCase()) ? name : `${brand} ${name}`;

  const pack = (h.salesUnit ?? h.shortDescription ?? "").replace(/\.$/, "").trim() || null;
  const p = parsePack(pack);
  const priceCents = Math.round(regular * 100);
  const unitPriceCents = p && p.size > 0 ? Math.round(priceCents / p.size) : null;

  const topCat = lvl0.find((c) => !NON_TOP.test(c)) ?? null;
  const path = lvl1.find((c) => topCat && c.startsWith(topCat)) ?? null;
  const image = h.assets?.find((a) => a.type === "primary")?.url ?? h.assets?.[0]?.url ?? null;

  return {
    store: "aldi",
    externalId: h.objectID,
    title,
    brand,
    ownBrand,
    categoryTop: topCat,
    categoryPath: path,
    packLabel: pack,
    ean: null,
    imageUrl: image,
    url: h.productSlug ? `${BASE}/product/${h.productSlug}.html` : null,
    available: true,
    priceCents,
    unitPriceCents,
    promo: hasPromo
      ? {
          priceCents: Math.round(promoUnit! * 100),
          label: label || "aanbieding",
          startsAt: promo?.validFrom ? new Date(promo.validFrom * 1000) : null,
          endsAt: promo?.validUntil ? new Date(promo.validUntil * 1000) : weekEnd(now),
        }
      : null,
  };
}

async function page(url: string): Promise<string> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" } });
      if (res.ok) return await res.text();
      last = new Error(`${url} → HTTP ${res.status}`);
    } catch (e) {
      last = e;
    }
    await sleep(1000 * 2 ** attempt);
  }
  throw last;
}

function hitsOf(html: string): AldiHit[] {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  const data = JSON.parse(m[1]) as unknown;
  const stack: unknown[] = [data];
  while (stack.length) {
    const c = stack.pop();
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    if (o.initialResults && typeof o.initialResults === "object") {
      const res = Object.values(o.initialResults as Record<string, { results?: { hits?: AldiHit[] }[] }>)[0];
      return res?.results?.[0]?.hits ?? [];
    }
    for (const v of Object.values(o)) stack.push(v);
  }
  return [];
}

export const aldiCrawler: Crawler = {
  store: "aldi",
  async *crawlAll(opts: CrawlOptions = {}) {
    const log = opts.log ?? (() => {});
    const index = await page(`${BASE}/producten.html`);
    const links = [...new Set(index.match(/https:\/\/www\.aldi\.nl\/producten\/[a-z0-9-]+\/[a-z0-9-]+\.html/g) ?? [])];
    if (links.length < 20) throw new Error(`Aldi: maar ${links.length} categoriepagina's gevonden — is de site veranderd?`);

    const seen = new Set<string>();
    let skipped = 0;
    const now = new Date();
    for (const link of links) {
      let hits: AldiHit[] = [];
      try {
        hits = hitsOf(await page(link));
      } catch (e) {
        skipped++;
        log(`Aldi ${link.split("/producten/")[1]}: overgeslagen (${e instanceof Error ? e.message : e})`);
      }
      const batch: CrawledProduct[] = [];
      for (const h of hits) {
        if (!h.objectID || seen.has(h.objectID)) continue;
        seen.add(h.objectID);
        const m = mapAldi(h, now);
        if (m) batch.push(m);
      }
      if (batch.length) yield batch;
      await sleep(DELAY_MS);
    }
    log(`Aldi: ${seen.size} producten uit ${links.length - skipped} categoriepagina's`);
  },
};
