// Lidl — echte prijsbron via de (onofficiële) winkel-zoek-API.
// Geen login nodig; endpoint kan zonder aankondiging veranderen.
// Alleen actief als DATA_MODE=live. Draai daarna `npm run ingest`.
//
// Bron/afspraken: zie /betrouwbaarheid — Korf gebruikt dit voor eigen/persoonlijk
// gebruik.

import { CATALOG } from "../mock-data";
import type { NormalisedProduct, PriceProvider } from "./types";

const SEARCH_URL = "https://www.lidl.nl/q/api/search";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Grove lijst met bekende Lidl-huismerken, voor de ownBrand-vlag.
const OWN_BRANDS = [
  "milbona",
  "vemondo",
  "freshona",
  "alesto",
  "solevita",
  "harvest basket",
  "bellarom",
  "cien",
  "w5",
  "crivit",
  "silvercrest",
  "parkside",
  "livarno",
];

interface LidlPrice {
  price: number;
  oldPrice?: number;
  discount?: { deletedPrice?: number; discountText?: string; bargainHintText?: string };
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

/** Lidl's zoek-API doorzoekt het hele assortiment; niet-boodschappen eruit filteren. */
function isGrocery(category?: string): boolean {
  if (!category) return true;
  if (category === "Non Food") return false;
  if (category.startsWith("Assortiment/")) return false;
  return true;
}

function mapItem(item: LidlItem): NormalisedProduct | null {
  const d = item.gridbox?.data;
  if (!d || !d.fullTitle || !isGrocery(d.category)) return null;
  // sommige items hebben geen vaste prijs (bv. een prijsrange bij variantenverschil) — overslaan
  if (typeof d.price?.price !== "number" || !Number.isFinite(d.price.price)) return null;

  const brandName = d.brand?.name ?? "";
  const ownBrand = !brandName || OWN_BRANDS.includes(brandName.toLowerCase());
  const oldPrice = d.price.oldPrice || d.price.discount?.deletedPrice || null;
  const onSale = oldPrice != null && oldPrice > d.price.price;

  return {
    supermarketSlug: "lidl",
    brand: brandName || "Lidl",
    ownBrand,
    title: d.fullTitle,
    canonicalSlug: null,
    externalId: d.erpNumber ?? (d.productId != null ? String(d.productId) : null),
    externalUrl: d.canonicalUrl ? `https://www.lidl.nl${d.canonicalUrl}` : null,
    imageUrl: d.image ?? null,
    priceCents: Math.round(d.price.price * 100),
    unitPriceCents: null,
    promo: onSale
      ? {
          priceCents: Math.round(d.price.price * 100),
          label: d.price.discount?.discountText || d.price.discount?.bargainHintText || "aanbieding",
          endsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        }
      : null,
  };
}

async function fetchSearch(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  // af en toe een losse 406 — één keer opnieuw proberen is genoeg
  if (res.status === 406) return fetch(url, { headers: { "User-Agent": UA } });
  return res;
}

async function search(query: string): Promise<NormalisedProduct[]> {
  const url = `${SEARCH_URL}?fetchsize=15&locale=nl_NL&assortment=NL&version=2.1.0&idsonly=false&q=${encodeURIComponent(query)}`;
  const res = await fetchSearch(url);
  if (!res.ok) throw new Error(`Lidl search ${res.status}`);
  const j = (await res.json()) as { items?: LidlItem[] };
  return (j.items ?? []).map(mapItem).filter((p): p is NormalisedProduct => p !== null);
}

/** Simpele trefwoord-match: alle betekenisvolle woorden uit de canonieke naam in de titel. */
function matchesCanonical(canonName: string, title: string): boolean {
  const words = canonName
    .toLowerCase()
    .replace(/\d+\s*(g|kg|l|ml|st|stuks|pack)\b/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const t = title.toLowerCase();
  return words.length > 0 && words.every((w) => t.includes(w));
}

export const lidlProvider: PriceProvider = {
  slug: "lidl",
  label: "Lidl",
  mode: "live",
  search,
  async listAll() {
    const out: NormalisedProduct[] = [];
    for (const cp of CATALOG) {
      try {
        const hits = await search(cp.name);
        const best = hits.find((h) => matchesCanonical(cp.name, h.title)) ?? hits[0];
        if (best) out.push({ ...best, canonicalSlug: cp.id });
      } catch {
        // sla dit product over bij een fout — de rest gaat door
      }
    }
    return out;
  },
};
