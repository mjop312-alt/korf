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

/**
 * Sjablonen voor "nieuwe lijst van sjabloon". Geen vaste producten meer: elke zoekterm wordt bij
 * het aanmaken omgezet in de best passende productgroep uit de catalogus (liefst een die in
 * meerdere winkels te koop is), zodat een sjabloon altijd echte, actuele producten geeft.
 */
export const LIST_TEMPLATES: Record<string, { label: string; terms: string[] }> = {
  weekly: {
    label: "Wekelijkse boodschappen",
    terms: ["halfvolle melk 1 l", "brood", "eieren", "koffie 500 g", "roomboter 250 g", "kipfilet", "yoghurt 1 l", "appelsap 1 l"],
  },
  weekend: {
    label: "Weekend",
    terms: ["chips", "cola 1.5 l", "pils", "pizza", "chocolade"],
  },
  schoonmaak: {
    label: "Schoonmaak & huishouden",
    terms: ["afwasmiddel", "toiletpapier", "wasmiddel"],
  },
};
