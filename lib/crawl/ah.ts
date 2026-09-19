// Albert Heijn — volledige catalogus via de (onofficiële) mobiele webshop-API.
// De zoekopdracht stopt bij 10.000 resultaten, dus we lopen per hoofdcategorie
// (`taxonomyId`) en halen 1.000 producten per verzoek op (~60 verzoeken per ronde).

import type { CrawledProduct, CrawlOptions, Crawler } from "./types";
import { fetchJson, lastNumberCents, parseDate, sleep } from "./util";

const AUTH_URL = "https://api.ah.nl/mobile-auth/v1/auth/token/anonymous";
const SEARCH_URL = "https://api.ah.nl/mobile-services/product/search/v2";
const CATEGORIES_URL = "https://api.ah.nl/mobile-services/v1/product-shelves/categories";
const PAGE_SIZE = 1000;
const MAX_OFFSET = 3000; // AH: HTTP 400 vanaf offset 3.000
const DELAY_MS = 300;

let cachedToken: { value: string; expiresAt: number } | null = null;

async function headers(): Promise<Record<string, string>> {
  if (!cachedToken || cachedToken.expiresAt < Date.now() + 60_000) {
    const j = await fetchJson<{ access_token: string }>(
      AUTH_URL,
      {
        method: "POST",
        headers: { "X-Application": "AHWEBSHOP", "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: "appie" }),
      },
      { label: "AH auth" },
    );
    cachedToken = { value: j.access_token, expiresAt: Date.now() + 6 * 24 * 3_600_000 };
  }
  return { Authorization: `Bearer ${cachedToken.value}`, "X-Application": "AHWEBSHOP" };
}

interface AHProduct {
  webshopId?: number;
  title?: string;
  brand?: string;
  salesUnitSize?: string;
  unitPriceDescription?: string | null;
  images?: { url: string; width?: number }[];
  mainCategory?: string;
  subCategory?: string;
  priceBeforeBonus?: number;
  currentPrice?: number;
  isBonus?: boolean;
  /** NATIONAL = echte bonus; AHONLINE = online-volumevoordeel op grootverpakkingen (geen aanbieding). */
  promotionType?: string;
  isBonusPrice?: boolean;
  bonusMechanism?: string;
  bonusStartDate?: string;
  bonusEndDate?: string;
  discountLabels?: { defaultDescription?: string }[];
  isOrderable?: boolean;
}
interface AHSearch {
  products?: AHProduct[];
  page?: { totalPages?: number; totalElements?: number };
  filters?: { id: string; options?: { id: string; label: string }[] }[];
}
interface AHCategory {
  id: number;
  name: string;
}

const OWN_BRAND = /^(AH|Albert Heijn)\b/i;
// alleen een kale prijsverlaging verrekenen; volume/1+1/2e-halve-prijs blijft label
const NOT_A_SIMPLE_CUT = /volume|1\s*\+\s*1|2e\b|gratis|stapel|pakket|korting op/i;

function map(p: AHProduct, fallbackCategory: string): CrawledProduct | null {
  const regular = p.priceBeforeBonus ?? p.currentPrice;
  if (regular == null || !p.title || p.webshopId == null) return null;

  const brand = p.brand?.trim() || "AH";
  const top = p.mainCategory || fallbackCategory;
  const image = p.images?.slice().sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? null;

  let promo: CrawledProduct["promo"] = null;
  if (p.isBonus && p.promotionType !== "AHONLINE") {
    const cut =
      p.isBonusPrice !== false &&
      p.currentPrice != null &&
      p.currentPrice < regular &&
      !NOT_A_SIMPLE_CUT.test(p.bonusMechanism ?? "");
    promo = {
      priceCents: cut ? Math.round(p.currentPrice! * 100) : null,
      label: p.bonusMechanism || p.discountLabels?.[0]?.defaultDescription || "bonus",
      startsAt: parseDate(p.bonusStartDate),
      endsAt: parseDate(p.bonusEndDate, true),
    };
  }

  return {
    store: "ah",
    externalId: String(p.webshopId),
    title: p.title,
    brand,
    ownBrand: OWN_BRAND.test(brand),
    categoryTop: top || null,
    categoryPath: [top, p.subCategory].filter(Boolean).join(" > ") || null,
    packLabel: p.salesUnitSize ?? null,
    ean: null,
    imageUrl: image,
    url: `https://www.ah.nl/producten/product/wi${p.webshopId}`,
    available: p.isOrderable !== false,
    priceCents: Math.round(regular * 100),
    unitPriceCents: lastNumberCents(p.unitPriceDescription),
    promo,
  };
}

/**
 * Eén (sub)categorie doorlopen. AH geeft HTTP 400 vanaf offset 3.000, dus een categorie met
 * meer dan 3.000 producten wordt opgedeeld in zijn subcategorieën (die AH als
 * "taxonomy"-filter meegeeft en die zelf als `taxonomyId` werken).
 */
async function* crawlTaxonomy(
  id: number | string,
  name: string,
  topName: string,
  seen: Set<string>,
  log: (m: string) => void,
  depth = 0,
): AsyncGenerator<CrawledProduct[]> {
  let page = 0;
  let totalPages = 1;
  while (page < totalPages && page * PAGE_SIZE < MAX_OFFSET) {
    const url = `${SEARCH_URL}?query=&size=${PAGE_SIZE}&page=${page}&taxonomyId=${id}`;
    const j = await fetchJson<AHSearch>(url, { headers: await headers() }, { label: `AH ${name} p${page}` });
    totalPages = j.page?.totalPages ?? 1;

    const batch: CrawledProduct[] = [];
    for (const p of j.products ?? []) {
      const m = map(p, topName);
      if (m && !seen.has(m.externalId)) {
        seen.add(m.externalId);
        batch.push(m);
      }
    }
    if (batch.length) yield batch;

    const total = j.page?.totalElements ?? 0;
    if (page === 0 && total > MAX_OFFSET) {
      const children = j.filters?.find((f) => f.id === "taxonomy")?.options ?? [];
      if (!children.length || depth >= 2) {
        log(`AH ${name}: ${total} producten maar geen subcategorieën — alleen de eerste ${MAX_OFFSET} bereikbaar`);
      } else {
        log(`AH ${name}: ${total} producten → opgedeeld in ${children.length} subcategorieën`);
        for (const child of children) {
          await sleep(DELAY_MS);
          yield* crawlTaxonomy(child.id, `${name} › ${child.label}`, topName, seen, log, depth + 1);
        }
        return;
      }
    }
    page++;
    await sleep(DELAY_MS);
  }
}

export const ahCrawler: Crawler = {
  store: "ah",
  async *crawlAll(opts: CrawlOptions = {}) {
    const log = opts.log ?? (() => {});
    const categories = await fetchJson<AHCategory[]>(CATEGORIES_URL, { headers: await headers() }, { label: "AH categorieën" });
    const seen = new Set<string>();

    for (const cat of categories) {
      const before = seen.size;
      yield* crawlTaxonomy(cat.id, cat.name, cat.name, seen, log);
      log(`AH ${cat.name}: ${seen.size - before} nieuw (totaal ${seen.size})`);
    }
  },
};
