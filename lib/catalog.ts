// Korf — catalogus-helpers. Bepalen welke merkkeuzes zinvol zijn gegeven de
// winkels die de gebruiker heeft aangevinkt.

import type { BrandMode, CanonicalProduct, StoreId } from "./types";

export interface BrandChoiceOption {
  /** Serialiseerbare waarde voor een <select>. */
  value: string;
  label: string;
  mode: BrandMode;
}

/**
 * De merken van dit product die bij ten minste één van de gekozen winkels
 * te koop zijn, plus of daar een huismerk tussen zit.
 */
export function availableBrands(
  product: CanonicalProduct,
  storeIds: StoreId[],
): { brands: string[]; hasOwnBrand: boolean; hasABrand: boolean } {
  const inScope = product.variants.filter((v) => storeIds.includes(v.store));
  const brands: string[] = [];
  for (const v of inScope) if (!brands.includes(v.brand)) brands.push(v.brand);
  return {
    brands,
    hasOwnBrand: inScope.some((v) => v.ownBrand),
    hasABrand: inScope.some((v) => !v.ownBrand),
  };
}

/** Opties voor de BrandChoice-select, gefilterd op de gekozen winkels. */
export function brandChoiceOptions(
  product: CanonicalProduct,
  storeIds: StoreId[],
): BrandChoiceOption[] {
  const { brands, hasOwnBrand, hasABrand } = availableBrands(product, storeIds);
  return [
    { value: "any", label: "Merk: maakt niet uit", mode: "any" },
    ...brands.map((b) => ({ value: `brand:${b}`, label: `Merk: ${b}`, mode: { brand: b } as BrandMode })),
    ...(hasABrand ? [{ value: "a_brand", label: "Altijd A-merk", mode: "a_brand" as BrandMode }] : []),
    ...(hasOwnBrand ? [{ value: "own", label: "Alleen huismerk", mode: "own" as BrandMode }] : []),
  ];
}

/** Is de gekozen merkvoorkeur nog haalbaar bij de huidige winkelselectie? */
export function isBrandModeAvailable(
  mode: BrandMode,
  product: CanonicalProduct,
  storeIds: StoreId[],
): boolean {
  if (mode === "any") return true;
  const { brands, hasOwnBrand, hasABrand } = availableBrands(product, storeIds);
  if (mode === "own") return hasOwnBrand;
  if (mode === "a_brand") return hasABrand;
  return brands.includes(mode.brand);
}

export function serialiseBrandMode(mode: BrandMode): string {
  return typeof mode === "string" ? mode : `brand:${mode.brand}`;
}

export function parseBrandMode(value: string): BrandMode {
  if (value === "any" || value === "own" || value === "a_brand") return value;
  return { brand: value.slice("brand:".length) };
}
