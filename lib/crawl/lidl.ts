// Lidl — volledige (food-)catalogus via de (onofficiële) zoek-API. Een zoekopdracht op
// "*" geeft het hele assortiment (incl. non-food); we pagineren met `offset` en houden
// alleen boodschappen over. Lidl geeft geen categoriepad en geen EAN.

import type { CrawledProduct, CrawlOptions, Crawler } from "./types";
import { fetchJson, lastNumberCents, parseDate, sleep, USER_AGENT } from "./util";

const SEARCH_URL = "https://www.lidl.nl/q/api/search";
const PAGE_SIZE = 100;
const DELAY_MS = 500;

// Bekende Lidl-huismerken (Lidl noemt ze zelf niet als zodanig in de API).
const OWN_BRANDS = new Set([
  "lidl", "milbona", "vemondo", "freshona", "alesto", "solevita", "harvest basket", "bellarom",
  "cien", "w5", "formil", "deluxe", "chef select", "pikok", "combino", "dulano", "sondey",
  "fin carré", "choceur", "mister choc", "coshida", "baresa", "italiamo", "freeway", "saguaro",
  "trattoria alfredo", "el tequito", "bio organic", "nixe", "favorina", "gelatelli",
  "sweet valley", "lord nelson", "bevola", "rioba", "vitasia", "asia green garden",
  "crownfield", "belbake",
]);

interface LidlPrice {
  price?: number;
  oldPrice?: number;
  endDate?: string;
  discount?: { deletedPrice?: number; discountText?: string; bargainHintText?: string };
  packaging?: { text?: string };
  basePrice?: { text?: string };
}
interface LidlItem {
  gridbox?: {
    data?: {
      fullTitle?: string;
      brand?: { name?: string };
      category?: string;
      price?: LidlPrice;
      productId?: number | string;
      erpNumber?: string;
      canonicalUrl?: string;
      image?: string;
    };
  };
}
interface LidlSearch {
  numFound?: number;
  items?: LidlItem[];
}

function map(item: LidlItem): CrawledProduct | null {
  const d = item.gridbox?.data;
  const price = d?.price;
  if (!d?.fullTitle || typeof price?.price !== "number" || !Number.isFinite(price.price)) return null;
  if (d.category !== "Food") return null; // "Non Food" en "Assortiment/…" zijn geen boodschappen

  const externalId = d.erpNumber ?? (d.productId != null ? String(d.productId) : null);
  if (!externalId) return null;

  // Lidl geeft niet altijd een merk. Staat de titel in HOOFDLETTERS te beginnen ("ROBIJN
  // Quickwash"), dan is dat het merk (A-merk tenzij bekend huismerk); zonder merkindicatie
  // is het een generiek Lidl-product ("Diepvries fruit") en dus huismerk.
  let brand = d.brand?.name?.trim() ?? "";
  if (!brand) {
    const first = d.fullTitle.trim().split(/\s+/)[0];
    const looksLikeBrand = first.length > 2 && first === first.toUpperCase() && /[A-Z]/.test(first);
    brand = looksLikeBrand ? first.charAt(0) + first.slice(1).toLowerCase() : "Lidl";
  }
  const ownBrand = brand === "Lidl" || OWN_BRANDS.has(brand.toLowerCase());

  // `price.price` is al de actieprijs; de schapprijs staat in oldPrice / discount.deletedPrice
  const before = price.oldPrice || price.discount?.deletedPrice || 0;
  const onSale = before > price.price;
  const regularCents = Math.round((onSale ? before : price.price) * 100);

  const baseText = price.basePrice?.text;
  const unitCents = baseText && /=/.test(baseText) ? lastNumberCents(baseText.split("=").pop()) : null;

  return {
    store: "lidl",
    externalId,
    title: d.fullTitle,
    brand,
    ownBrand,
    categoryTop: null,
    categoryPath: null,
    packLabel: price.packaging?.text ?? null,
    ean: null,
    imageUrl: d.image ?? null,
    url: d.canonicalUrl ? `https://www.lidl.nl${d.canonicalUrl}` : null,
    available: true,
    priceCents: regularCents,
    unitPriceCents: unitCents,
    promo: onSale
      ? {
          priceCents: Math.round(price.price * 100),
          label: price.discount?.discountText || price.discount?.bargainHintText || "aanbieding",
          startsAt: null,
          endsAt: parseDate(price.endDate),
        }
      : null,
  };
}

export const lidlCrawler: Crawler = {
  store: "lidl",
  async *crawlAll(opts: CrawlOptions = {}) {
    const log = opts.log ?? (() => {});
    const seen = new Set<string>();
    let total = Infinity;
    let scanned = 0;

    for (let offset = 0; offset < total; ) {
      const url = `${SEARCH_URL}?fetchsize=${PAGE_SIZE}&offset=${offset}&locale=nl_NL&assortment=NL&version=2.1.0&idsonly=false&q=*`;
      const j = await fetchJson<LidlSearch>(url, { headers: { "User-Agent": USER_AGENT } }, { label: `Lidl @${offset}` });
      total = j.numFound ?? 0;
      const items = j.items ?? [];
      if (!items.length) break;

      const batch: CrawledProduct[] = [];
      for (const it of items) {
        const m = map(it);
        if (m && !seen.has(m.externalId)) {
          seen.add(m.externalId);
          batch.push(m);
        }
      }
      scanned += items.length;
      if (batch.length) yield batch;
      offset += items.length;
      await sleep(DELAY_MS);
    }
    log(`Lidl: ${seen.size} food-producten van ${scanned} gescand`);
  },
};
