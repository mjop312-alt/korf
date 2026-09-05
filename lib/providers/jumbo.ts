// Jumbo — echte prijsbron via de (onofficiële) GraphQL-zoek-API.
// Geen login nodig; endpoint kan zonder aankondiging veranderen. Vereist specifieke
// Apollo-clientheaders, anders 401 "No client headers set".
// Alleen actief als DATA_MODE=live. Draai daarna `npm run ingest`.
//
// Bron/afspraken: zie /betrouwbaarheid — Korf gebruikt dit voor eigen/persoonlijk
// gebruik.

import { CATALOG } from "../mock-data";
import type { NormalisedProduct, PriceProvider } from "./types";

const GRAPHQL_URL = "https://www.jumbo.com/api/graphql";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const QUERY = `query SearchProducts($input: ProductSearchInput!) {
  searchProducts(input: $input) {
    products {
      id
      title
      brand
      price { price promoPrice pricePerUnit { price unit } }
      promotions { tags { text } title }
    }
  }
}`;

interface JumboProduct {
  id: string;
  title: string;
  brand?: string;
  price: { price: number; promoPrice: number | null; pricePerUnit?: { price: number } | null };
  promotions?: { tags?: { text?: string }[]; title?: string }[];
}

function mapProduct(p: JumboProduct): NormalisedProduct | null {
  if (!p.title || typeof p.price?.price !== "number" || !Number.isFinite(p.price.price)) return null;

  const brand = p.brand || "Jumbo";
  const onSale = p.price.promoPrice != null && p.price.promoPrice < p.price.price;
  const promoLabel = p.promotions?.[0]?.title || p.promotions?.[0]?.tags?.[0]?.text;

  return {
    supermarketSlug: "jumbo",
    brand,
    ownBrand: /^jumbo/i.test(brand),
    title: p.title,
    canonicalSlug: null,
    externalId: p.id,
    priceCents: Math.round(p.price.price),
    unitPriceCents: p.price.pricePerUnit?.price ?? null,
    // alleen een kale prijsverlaging verrekenen; een label zonder lagere stukprijs
    // (bv. "1+1 gratis") blijft alleen een label, net als bij AH.
    promo: onSale
      ? {
          priceCents: Math.round(p.price.promoPrice!),
          label: promoLabel || "aanbieding",
          endsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        }
      : promoLabel
        ? { priceCents: null, label: promoLabel, endsAt: new Date(Date.now() + 7 * 86_400_000).toISOString() }
        : null,
  };
}

async function search(query: string): Promise<NormalisedProduct[]> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apollographql-client-name": "basis-web",
      "apollographql-client-version": "1.0.0",
      "User-Agent": UA,
      Origin: "https://www.jumbo.com",
      Referer: "https://www.jumbo.com/",
    },
    body: JSON.stringify({
      operationName: "SearchProducts",
      variables: {
        input: {
          searchType: "keyword",
          searchTerms: query,
          offSet: 0,
          friendlyUrl: "",
          currentUrl: "",
          previousUrl: "",
          bloomreachCookieId: "",
        },
      },
      query: QUERY,
    }),
  });
  if (!res.ok) throw new Error(`Jumbo search ${res.status}`);
  const j = (await res.json()) as {
    data?: { searchProducts?: { products?: JumboProduct[] } };
    errors?: unknown[];
  };
  if (j.errors) throw new Error(`Jumbo search errors: ${JSON.stringify(j.errors)}`);
  return (j.data?.searchProducts?.products ?? []).map(mapProduct).filter((p): p is NormalisedProduct => p !== null);
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

export const jumboProvider: PriceProvider = {
  slug: "jumbo",
  label: "Jumbo",
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
