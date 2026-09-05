// Vertaling tussen de database-representatie van een lijstregel en de BrandMode
// die de scenario-engine gebruikt.

import type { BrandMode } from "./types";

/** DB (brandMode-string + merknaam) → engine BrandMode. */
export function dbToBrandMode(
  brandMode: string,
  pinnedBrandName: string | null | undefined,
): BrandMode {
  if (brandMode === "pinned_brand" && pinnedBrandName) return { brand: pinnedBrandName };
  if (brandMode === "own_brand") return "own";
  if (brandMode === "a_brand") return "a_brand";
  return "any";
}

/** engine BrandMode → DB-velden (merk-id resolven doet de server-action). */
export function brandModeToDb(mode: BrandMode): { brandMode: string; brandName: string | null } {
  if (mode === "any") return { brandMode: "any", brandName: null };
  if (mode === "own") return { brandMode: "own_brand", brandName: null };
  if (mode === "a_brand") return { brandMode: "a_brand", brandName: null };
  return { brandMode: "pinned_brand", brandName: mode.brand };
}

/** Sjablonen voor "nieuwe lijst van sjabloon" — verwijzingen naar canonieke product-slugs. */
export const LIST_TEMPLATES: Record<string, { label: string; slugs: string[] }> = {
  weekly: {
    label: "Wekelijkse boodschappen",
    slugs: ["melk", "brood", "eieren", "koffie", "bananen", "roomboter", "kipfilet", "yoghurt"],
  },
  weekend: {
    label: "Weekend",
    slugs: ["chips", "cola", "bier", "stroopwafels", "pizza", "chocolade"],
  },
  schoonmaak: {
    label: "Schoonmaak & huishouden",
    slugs: ["wasmiddel", "afwasmiddel", "allesreiniger", "keukenrol", "vuilniszakken", "toiletpapier"],
  },
};
