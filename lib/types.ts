// Korf — kern-datatypes voor de vergelijking.
// Bedragen ALTIJD in hele centen (integer) om afrondingsfouten te vermijden.

export type StoreId = string;

export type Unit = "piece" | "kg" | "litre" | "pack";

export interface Supermarket {
  id: StoreId;
  name: string;
  short: string;
  brandColor: string;
}

export interface Promotion {
  /** Effectieve kale actieprijs in centen, of null als de korting niet in de prijs is te verrekenen (1+1, 2e halve prijs, cashback). */
  priceCents: number | null;
  label: string;
  endsAt: string; // ISO-datum
}

/** Eén concreet schap-artikel bij één supermarkt (in het datamodel: StoreProduct + Price). */
export interface StoreProduct {
  store: StoreId;
  brand: string;
  ownBrand: boolean;
  priceCents: number;
  unitPriceCents?: number;
  promo?: Promotion;
  /** Echte productfoto bij de winkelbron. Ontbreekt in de mockdata; de UI valt dan
   *  terug op een gegenereerde tegel (zie lib/product-visuals.ts). */
  imageUrl?: string;
}

/** Het canonieke product waar winkelvarianten aan hangen. */
export interface CanonicalProduct {
  id: string;
  name: string;
  category: string;
  baseUnit: Unit;
  /** Merk-neutrale productfoto (fallback als een variant geen eigen imageUrl heeft). */
  imageUrl?: string;
  variants: StoreProduct[];
}

/** Merkvoorkeur per lijstregel. "a_brand" = altijd een A-merk (nooit huismerk). */
export type BrandMode = "any" | "own" | "a_brand" | { brand: string };

export interface ListItem {
  id: string;
  productId: string;
  quantity: number;
  brandMode: BrandMode;
  /** Handmatige "kies zelf"-override: per winkel een vastgezet store-product-id. Nog niet gebruikt door de MVP-engine. */
  pinned?: Partial<Record<StoreId, string>>;
}

export interface CompareOptions {
  storeIds: StoreId[];
  /** Max. winkels voor scenario C (Beste balans). Default 2. */
  maxStoresBalanced?: number;
  /** Scenario C opent alleen een tweede winkel als dat minstens dit bedrag scheelt. Default 200 (€2). */
  minExtraStoreSavingCents?: number;
}

export interface Candidate {
  storeId: StoreId;
  title: string;
  brand: string;
  ownBrand: boolean;
  effectiveCents: number;
  regularCents: number;
  unitPriceCents: number | null;
  promo: Promotion | null;
  lineCents: number;
}

export interface MissingCell {
  missing: true;
  reason: string;
}

export interface Scenario {
  storeIds: StoreId[];
  totalCents: number;
  savingCents: number;
  /** Per lijstregel (itemId) de winkel waar je 'm in dit scenario haalt. */
  assignment: Record<string, StoreId>;
}

export interface CompareRow {
  itemId: string;
  label: string;
  quantity: number;
  brandMode: BrandMode;
  perStore: Record<StoreId, Candidate | MissingCell>;
  cheapestStoreId: StoreId | null;
}

export interface CompareResult {
  rows: CompareRow[];
  perStoreTotals: Record<StoreId, { totalCents: number; missing: number }>;
  /** Winkels die de héle lijst hebben, oplopend op totaal. */
  complete: Array<{ storeId: StoreId; totalCents: number }>;
  cheapestSingle: Scenario | null; // A
  balanced: Scenario | null; // C
  maxSplit: Scenario | null; // B
  recommended: "cheapestSingle" | "balanced" | null;
  referenceTotalCents: number;
  referenceLabel: string;
  warnings: string[];
}
