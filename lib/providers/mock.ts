// MockProvider — levert de demodata uit lib/mock-data.ts in het PriceProvider-formaat.
// Dit is de standaardbron zolang er geen echte API is aangesloten.

import { CATALOG } from "../mock-data";
import type { NormalisedProduct, PriceProvider } from "./types";

function flatten(): NormalisedProduct[] {
  const out: NormalisedProduct[] = [];
  for (const product of CATALOG) {
    for (const v of product.variants) {
      out.push({
        supermarketSlug: v.store,
        brand: v.brand,
        ownBrand: v.ownBrand,
        title: `${v.brand} ${product.name}`,
        canonicalSlug: product.id,
        packUnit: product.baseUnit,
        priceCents: v.priceCents,
        unitPriceCents: v.unitPriceCents ?? null,
        promo: v.promo ?? null,
      });
    }
  }
  return out;
}

export const mockProvider: PriceProvider = {
  slug: "mock",
  label: "Demodata",
  mode: "mock",
  async search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return flatten().filter((p) => p.title.toLowerCase().includes(q));
  },
  async listAll() {
    return flatten();
  },
};
