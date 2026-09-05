// Korf — data-integratielaag.
//
// Elke prijsbron (mock, of later een officiële API / partnerfeed) implementeert
// `PriceProvider`. De ingestion-worker (scripts/ingest.ts) roept de providers aan,
// normaliseert naar `NormalisedProduct` en schrijft naar de database. De app leest
// daarna uitsluitend uit Postgres — nooit een live-call in het request-pad.

export interface NormalisedPromo {
  /** Effectieve kale actieprijs in centen; null ⇒ alleen label (1+1, 2e halve prijs, x-voor-y). */
  priceCents: number | null;
  label: string;
  endsAt: string; // ISO-datum
}

export interface NormalisedProduct {
  supermarketSlug: string; // "ah" | "jumbo" | "lidl" | ...
  brand: string;
  ownBrand: boolean;
  title: string;
  /** Koppeling aan een canoniek product (slug). null ⇒ nog niet gematcht. */
  canonicalSlug: string | null;
  ean?: string | null;
  packSize?: number | null;
  packUnit?: string | null; // piece | kg | litre | pack
  externalId?: string | null;
  externalUrl?: string | null;
  imageUrl?: string | null;
  priceCents: number;
  unitPriceCents?: number | null;
  promo?: NormalisedPromo | null;
}

export interface PriceProvider {
  slug: string; // "mock" | "ah" | "jumbo" | "lidl"
  label: string;
  mode: "mock" | "live";
  /** Zoekt producten (voor de zoekbalk-index en voor ingestion op trefwoord). */
  search(query: string): Promise<NormalisedProduct[]>;
  /** Optioneel: het volledige (of actie-)assortiment ophalen voor ingestion. */
  listAll?(): Promise<NormalisedProduct[]>;
}
