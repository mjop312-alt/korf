// Albert Heijn — echte prijsbron via de (onofficiële) mobiele webshop-API.
// Geen login nodig; endpoints kunnen zonder aankondiging veranderen.
// Alleen actief als DATA_MODE=live. Draai daarna `npm run ingest`.
//
// Bron/afspraken: zie /betrouwbaarheid — Korf gebruikt dit voor eigen/persoonlijk
// gebruik en verrekent geen bonuskaart-kortingen.

import { CATALOG } from "../mock-data";
import type { NormalisedProduct, PriceProvider } from "./types";

const AUTH_URL = "https://api.ah.nl/mobile-auth/v1/auth/token/anonymous";
const SEARCH_URL = "https://api.ah.nl/mobile-services/product/search/v2";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function token(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "X-Application": "AHWEBSHOP", "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: "appie" }),
  });
  if (!res.ok) throw new Error(`AH auth ${res.status}`);
  const j = (await res.json()) as { access_token: string };
  cachedToken = { value: j.access_token, expiresAt: Date.now() + 6 * 24 * 3_600_000 };
  return j.access_token;
}

function parseUnitPrice(desc?: string | null): number | null {
  if (!desc) return null;
  const m = desc.match(/([\d]+[.,]?[\d]*)/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

interface AHProduct {
  webshopId?: number;
  title: string;
  brand?: string;
  priceBeforeBonus?: number;
  currentPrice?: number;
  isBonus?: boolean;
  bonusMechanism?: string;
  bonusEndDate?: string;
  unitPriceDescription?: string | null;
}

function mapProduct(p: AHProduct): NormalisedProduct | null {
  const base = p.priceBeforeBonus ?? p.currentPrice;
  if (base == null || !p.title) return null;

  // Alleen een kale prijsverlaging verrekenen we; volume/1+1/2e-halve-prijs = label.
  const simpleCut =
    !!p.isBonus &&
    p.currentPrice != null &&
    p.currentPrice < base &&
    !/volume|1\s*\+\s*1|2e\b|gratis|stapel|pakket|korting op/i.test(p.bonusMechanism ?? "");

  return {
    supermarketSlug: "ah",
    brand: p.brand || "AH",
    ownBrand: !p.brand || /^AH\b/i.test(p.brand),
    title: p.title,
    canonicalSlug: null,
    externalId: p.webshopId != null ? String(p.webshopId) : null,
    priceCents: Math.round(base * 100),
    unitPriceCents: parseUnitPrice(p.unitPriceDescription),
    promo: p.isBonus
      ? {
          priceCents: simpleCut ? Math.round(p.currentPrice! * 100) : null,
          label: p.bonusMechanism || "bonus",
          endsAt: p.bonusEndDate || new Date(Date.now() + 7 * 86_400_000).toISOString(),
        }
      : null,
  };
}

async function search(query: string): Promise<NormalisedProduct[]> {
  const t = await token();
  const res = await fetch(`${SEARCH_URL}?query=${encodeURIComponent(query)}&size=15`, {
    headers: { Authorization: `Bearer ${t}`, "X-Application": "AHWEBSHOP" },
  });
  if (!res.ok) throw new Error(`AH search ${res.status}`);
  const j = (await res.json()) as { products?: AHProduct[] };
  return (j.products ?? []).map(mapProduct).filter((p): p is NormalisedProduct => p !== null);
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

export const ahProvider: PriceProvider = {
  slug: "ah",
  label: "Albert Heijn",
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
