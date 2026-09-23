// Dieetfilters — geen apart datamodel: winkels zetten dit soort labels vaak letterlijk in de
// producttitel ("Vegetarische...", "Glutenvrij", "Biologisch..."), dus net als bij zoeken werkt
// een woordcontrole op `StoreProduct.searchText` prima. Bewust geen AI/externe voedingsdatabank —
// alleen wat de winkel zelf al claimt in de naam. Steekproef op de catalogus (sept. 2026) om de
// keuzes hieronder te onderbouwen: vegetarisch 124, vegan 192, glutenvrij 459, lactosevrij 48,
// suikervrij 265, biologisch 1846 producten.

export interface DietTag {
  slug: string;
  label: string;
  /** voldoende als één van deze woorden in de productnaam/merk voorkomt */
  words: string[];
}

export const DIET_TAGS: DietTag[] = [
  { slug: "vegetarisch", label: "Vegetarisch", words: ["vegetarisch", "vegetarische"] },
  { slug: "veganistisch", label: "Veganistisch", words: ["vegan", "veganistisch", "plantaardig", "plantaardige"] },
  { slug: "glutenvrij", label: "Glutenvrij", words: ["glutenvrij", "glutenvrije"] },
  { slug: "lactosevrij", label: "Lactosevrij", words: ["lactosevrij", "lactosevrije"] },
  { slug: "suikervrij", label: "Weinig/geen suiker", words: ["suikervrij", "suikervrije", "suikerarm", "minder suiker", "zonder suiker"] },
  { slug: "biologisch", label: "Biologisch", words: ["biologisch", "biologische"] },
];

export function dietWords(slugs: string[]): string[][] {
  return slugs.map((slug) => DIET_TAGS.find((t) => t.slug === slug)?.words ?? [slug]).filter((w) => w.length);
}
