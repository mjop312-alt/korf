// Korf — catalogus-crawler. Elke supermarkt heeft een crawler die het HELE assortiment
// (alle merken, huismerken, prijzen en acties) doorloopt en teruggeeft als
// `CrawledProduct`-batches. `store.ts` schrijft die in bulk naar de database.

export type StoreSlug = "ah" | "jumbo" | "lidl" | "aldi" | "plus";

export interface CrawledPromo {
  /** Effectieve stukprijs tijdens de actie in centen; null ⇒ alleen label (1+1, 2e halve prijs, x voor y). */
  priceCents: number | null;
  label: string;
  startsAt: Date | null;
  /** null ⇒ de winkel geeft geen einddatum; store.ts valt dan terug op het einde van de week. */
  endsAt: Date | null;
}

export interface CrawledProduct {
  store: StoreSlug;
  externalId: string;
  title: string;
  brand: string;
  ownBrand: boolean;
  categoryTop: string | null;
  categoryPath: string | null;
  packLabel: string | null;
  ean: string | null;
  imageUrl: string | null;
  url: string | null;
  available: boolean;
  /** Schapprijs ZONDER actie, in centen. */
  priceCents: number;
  unitPriceCents: number | null;
  promo: CrawledPromo | null;
}

export interface CrawlOptions {
  log?: (message: string) => void;
}

/** Wat we van een bekend winkelproduct weten om het gericht te kunnen opzoeken. */
export interface LookupItem {
  externalId: string;
  title: string;
  categoryTop: string | null;
}

export interface Crawler {
  store: StoreSlug;
  /** Volledige ronde over het hele assortiment; levert batches (bv. één pagina). */
  crawlAll(opts?: CrawlOptions): AsyncGenerator<CrawledProduct[]>;
  /**
   * Eén bekend product gericht opnieuw ophalen (zoeken op titel) — voor het snel verversen van
   * producten die op lijsten staan, zonder het hele assortiment te doorlopen. null ⇒ niet gevonden.
   * Winkels zonder zoek-API hebben dit niet en blijven op de volledige ronde leunen.
   */
  lookup?(item: LookupItem): Promise<CrawledProduct | null>;
}
