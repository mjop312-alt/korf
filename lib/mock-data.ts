// Korf — mockdata. Realistische voorbeeldprijzen, GEEN actuele data.
// In productie komt dit uit PostgreSQL, gevuld door de ingestion-worker; dan bevat
// elk product ALLE merken die de bron kent, per winkel. Hier: een representatief
// assortiment over alle categorieën, met A-merken + huismerken per winkel.
//
// Regels die dit bestand aanhoudt:
//  - een merk hoort alleen bij een winkel die het echt verkoopt
//    (de UI filtert de merkkeuze hierop, zie lib/catalog.ts);
//  - Lidl heeft een beperkter assortiment — bewust een aantal "geen treffer"-gaten;
//  - bedragen in hele centen; unitPriceCents = prijs per baseUnit.

import type { CanonicalProduct, StoreProduct, Supermarket } from "./types";

export const SUPERMARKETS: Supermarket[] = [
  { id: "ah", name: "Albert Heijn", short: "AH", brandColor: "#0A7DB8" },
  { id: "jumbo", name: "Jumbo", short: "Jumbo", brandColor: "#C9770A" },
  { id: "lidl", name: "Lidl", short: "Lidl", brandColor: "#1C4E9C" },
];

const promo = (priceCents: number | null, label = "weekactie", endsAt = "2026-09-02") => ({
  priceCents,
  label,
  endsAt,
});

/** Kort: een huismerk-variant. `own(store, prijs, unitPrijs?)`. */
const own = (store: string, priceCents: number, unitPriceCents?: number): StoreProduct => {
  const name = store === "ah" ? "AH" : store === "jumbo" ? "Jumbo" : "Lidl";
  return { store, brand: name, ownBrand: true, priceCents, unitPriceCents };
};
/** Kort: een A-merk-variant. */
const a = (
  store: string,
  brand: string,
  priceCents: number,
  unitPriceCents?: number,
): StoreProduct => ({ store, brand, ownBrand: false, priceCents, unitPriceCents });

export const CATALOG: CanonicalProduct[] = [
  // ─────────────────────────── GROENTE & FRUIT ───────────────────────────
  {
    id: "bananen", name: "Bananen 1kg", category: "groente & fruit", baseUnit: "kg",
    variants: [
      own("ah", 179, 179), a("ah", "Chiquita", 219, 219),
      own("jumbo", 175, 175), a("jumbo", "Chiquita", 215, 215),
      own("lidl", 169, 169),
    ],
  },
  {
    id: "appels", name: "Appels elstar 1kg", category: "groente & fruit", baseUnit: "kg",
    variants: [own("ah", 249, 249), own("jumbo", 239, 239), own("lidl", 219, 219)],
  },
  {
    id: "trostomaten", name: "Trostomaten 500g", category: "groente & fruit", baseUnit: "kg",
    variants: [own("ah", 199, 398), own("jumbo", 189, 378), own("lidl", 169, 338)],
  },
  {
    id: "komkommer", name: "Komkommer", category: "groente & fruit", baseUnit: "piece",
    variants: [own("ah", 99), own("jumbo", 95), own("lidl", 89)],
  },
  {
    id: "paprika", name: "Paprika mix 3 stuks", category: "groente & fruit", baseUnit: "pack",
    variants: [own("ah", 279), own("jumbo", 269), own("lidl", 229)],
  },
  {
    id: "ijsbergsla", name: "IJsbergsla", category: "groente & fruit", baseUnit: "piece",
    variants: [own("ah", 129), own("jumbo", 125), own("lidl", 109)],
  },
  {
    id: "wortelen", name: "Winterpeen 1kg", category: "groente & fruit", baseUnit: "kg",
    variants: [own("ah", 139, 139), own("jumbo", 129, 129), own("lidl", 99, 99)],
  },
  {
    id: "uien", name: "Uien 1kg", category: "groente & fruit", baseUnit: "kg",
    variants: [own("ah", 129, 129), own("jumbo", 119, 119), own("lidl", 99, 99)],
  },
  {
    id: "sinaasappels", name: "Handsinaasappels net 2kg", category: "groente & fruit", baseUnit: "kg",
    variants: [own("ah", 349, 175), own("jumbo", 329, 165), own("lidl", 299, 150)],
  },
  {
    id: "aardappelen", name: "Kruimige aardappelen 2,5kg", category: "groente & fruit", baseUnit: "kg",
    variants: [own("ah", 299, 120), own("jumbo", 285, 114), own("lidl", 249, 100)],
  },
  {
    id: "champignons", name: "Kastanjechampignons 250g", category: "groente & fruit", baseUnit: "kg",
    variants: [own("ah", 149, 596), own("jumbo", 145, 580), own("lidl", 129, 516)],
  },
  {
    id: "avocado", name: "Avocado eetrijp", category: "groente & fruit", baseUnit: "piece",
    variants: [own("ah", 119), own("jumbo", 115), own("lidl", 99)],
  },

  // ─────────────────────────── ZUIVEL & EIEREN ───────────────────────────
  {
    id: "melk", name: "Halfvolle melk 1L", category: "zuivel", baseUnit: "litre",
    variants: [
      own("ah", 119, 119), a("ah", "Campina", 145, 145),
      own("jumbo", 125, 125), a("jumbo", "Campina", 149, 149),
      { store: "lidl", brand: "Milbona", ownBrand: true, priceCents: 105, unitPriceCents: 99, promo: promo(99) },
    ],
  },
  {
    id: "eieren", name: "Eieren vrije uitloop 10st", category: "zuivel", baseUnit: "piece",
    variants: [
      own("ah", 279), own("jumbo", 269),
      { store: "lidl", brand: "Lidl", ownBrand: true, priceCents: 255, promo: promo(229) },
    ],
  },
  {
    id: "roomboter", name: "Roomboter 250g", category: "zuivel", baseUnit: "kg",
    variants: [
      own("ah", 279, 1116), a("ah", "Kroon", 259, 1036),
      own("jumbo", 275, 1100),
      { store: "lidl", brand: "Milbona", ownBrand: true, priceCents: 239, unitPriceCents: 956 },
    ],
  },
  {
    id: "yoghurt", name: "Volle yoghurt 1L", category: "zuivel", baseUnit: "litre",
    variants: [
      own("ah", 115, 115), a("ah", "Zuivelhoeve", 219, 219),
      own("jumbo", 119, 119),
      { store: "lidl", brand: "Milbona", ownBrand: true, priceCents: 99, unitPriceCents: 99 },
    ],
  },
  {
    id: "vla", name: "Vanillevla 1L", category: "zuivel", baseUnit: "litre",
    variants: [
      own("ah", 109, 109), a("ah", "Campina", 159, 159),
      own("jumbo", 105, 105), a("jumbo", "Campina", 155, 155),
      { store: "lidl", brand: "Milbona", ownBrand: true, priceCents: 95, unitPriceCents: 95 },
    ],
  },
  {
    id: "jonge-kaas", name: "Jonge kaas plakken 250g", category: "zuivel", baseUnit: "kg",
    variants: [
      own("ah", 279, 1116), a("ah", "Beemster", 359, 1436),
      own("jumbo", 269, 1076),
      { store: "lidl", brand: "Milbona", ownBrand: true, priceCents: 235, unitPriceCents: 940 },
    ],
  },
  {
    id: "slagroom", name: "Slagroom 250ml", category: "zuivel", baseUnit: "litre",
    variants: [
      own("ah", 115, 460), a("ah", "MonaVella", 149, 596),
      own("jumbo", 109, 436),
      { store: "lidl", brand: "Milbona", ownBrand: true, priceCents: 99, unitPriceCents: 396 },
    ],
  },
  {
    id: "halvarine", name: "Halvarine kuip 500g", category: "zuivel", baseUnit: "kg",
    variants: [
      own("ah", 129, 258), a("ah", "Blue Band", 239, 478),
      own("jumbo", 125, 250), a("jumbo", "Blue Band", 235, 470),
      { store: "lidl", brand: "Vitello", ownBrand: true, priceCents: 99, unitPriceCents: 198 },
    ],
  },
  {
    id: "kwark", name: "Magere kwark 500g", category: "zuivel", baseUnit: "kg",
    variants: [
      own("ah", 149, 298), a("ah", "Arla Skyr", 219, 438),
      own("jumbo", 145, 290),
      { store: "lidl", brand: "Milbona", ownBrand: true, priceCents: 125, unitPriceCents: 250 },
    ],
  },

  // ─────────────────────────── VLEES & VIS ───────────────────────────
  {
    id: "kipfilet", name: "Kipfilet 300g", category: "vlees & vis", baseUnit: "kg",
    variants: [own("ah", 399, 1330), own("jumbo", 389, 1297), own("lidl", 349, 1163)],
  },
  {
    id: "gehakt", name: "Half-om-half gehakt 500g", category: "vlees & vis", baseUnit: "kg",
    variants: [own("ah", 399, 798), own("jumbo", 389, 778), own("lidl", 355, 710)],
  },
  {
    id: "rundergehakt", name: "Mager rundergehakt 500g", category: "vlees & vis", baseUnit: "kg",
    variants: [own("ah", 549, 1098), own("jumbo", 529, 1058), own("lidl", 479, 958)],
  },
  {
    id: "spekreepjes", name: "Spekreepjes naturel 250g", category: "vlees & vis", baseUnit: "kg",
    variants: [
      own("ah", 235, 940),
      own("jumbo", 229, 916),
      { store: "lidl", brand: "Pikok", ownBrand: true, priceCents: 199, unitPriceCents: 796 },
    ],
  },
  {
    id: "zalmfilet", name: "Zalmfilet 2 stuks 250g", category: "vlees & vis", baseUnit: "kg",
    variants: [own("ah", 549, 2196), own("jumbo", 529, 2116)],
    // Lidl: wisselend, hier geen vaste treffer
  },
  {
    id: "vegaburger", name: "Vegetarische burger 2 stuks", category: "vlees & vis", baseUnit: "pack",
    variants: [
      a("ah", "Vivera", 279), own("ah", 199),
      a("jumbo", "Vivera", 269), own("jumbo", 189),
      { store: "lidl", brand: "Next Level", ownBrand: true, priceCents: 179 },
    ],
  },

  // ─────────────────────────── BROOD & BAKKERIJ ───────────────────────────
  {
    id: "brood", name: "Bruin brood heel", category: "brood & bakkerij", baseUnit: "piece",
    variants: [own("ah", 139), own("jumbo", 135), own("lidl", 129)],
  },
  {
    id: "bolletjes", name: "Volkoren bolletjes 6 stuks", category: "brood & bakkerij", baseUnit: "pack",
    variants: [own("ah", 109), own("jumbo", 105), own("lidl", 89)],
  },
  {
    id: "croissants", name: "Roomboercroissants 4 stuks", category: "brood & bakkerij", baseUnit: "pack",
    variants: [own("ah", 199), own("jumbo", 189), own("lidl", 159)],
  },
  {
    id: "crackers", name: "Volkoren crackers", category: "brood & bakkerij", baseUnit: "pack",
    variants: [
      a("ah", "WASA", 199), own("ah", 129),
      a("jumbo", "WASA", 195), own("jumbo", 125),
      own("lidl", 109),
    ],
  },
  {
    id: "beschuit", name: "Beschuit rol", category: "brood & bakkerij", baseUnit: "pack",
    variants: [
      a("ah", "Bolletje", 149), own("ah", 89),
      a("jumbo", "Bolletje", 145), own("jumbo", 85),
      own("lidl", 75),
    ],
  },

  // ─────────────────────────── BROOD & BELEG ───────────────────────────
  {
    id: "pindakaas", name: "Pindakaas 350g", category: "brood & beleg", baseUnit: "kg",
    variants: [
      a("ah", "Calvé", 329, 940), a("ah", "Kroon", 289, 826), own("ah", 175, 500),
      a("jumbo", "Calvé", 319, 911), a("jumbo", "Kroon", 279, 797), own("jumbo", 189, 540),
    ],
    // Lidl: geen treffer in dit assortiment
  },
  {
    id: "hagelslag", name: "Hagelslag puur 400g", category: "brood & beleg", baseUnit: "kg",
    variants: [
      a("ah", "De Ruijter", 259, 648), a("ah", "Venz", 249, 623), own("ah", 139, 348),
      a("jumbo", "De Ruijter", 245, 613), a("jumbo", "Venz", 239, 598), own("jumbo", 135, 338),
    ],
  },
  {
    id: "jam", name: "Aardbeienjam 450g", category: "brood & beleg", baseUnit: "kg",
    variants: [
      a("ah", "Bonne Maman", 349, 776), own("ah", 155, 344),
      a("jumbo", "Hero", 279, 620), own("jumbo", 149, 331),
      { store: "lidl", brand: "Maribel", ownBrand: true, priceCents: 129, unitPriceCents: 287 },
    ],
  },
  {
    id: "chocopasta", name: "Chocoladepasta 400g", category: "brood & beleg", baseUnit: "kg",
    variants: [
      a("ah", "Nutella", 329, 823), own("ah", 165, 413),
      a("jumbo", "Nutella", 319, 798), own("jumbo", 159, 398),
      { store: "lidl", brand: "Choco Nussa", ownBrand: true, priceCents: 149, unitPriceCents: 373 },
    ],
  },
  {
    id: "kipfilet-vleeswaren", name: "Gebraden kipfilet vleeswaren 100g", category: "brood & beleg", baseUnit: "kg",
    variants: [
      own("ah", 189, 1890),
      own("jumbo", 185, 1850),
      { store: "lidl", brand: "Pikok", ownBrand: true, priceCents: 159, unitPriceCents: 1590 },
    ],
  },

  // ─────────────────────────── DIEPVRIES ───────────────────────────
  {
    id: "pizza", name: "Diepvriespizza margherita", category: "diepvries", baseUnit: "piece",
    variants: [
      a("ah", "Dr. Oetker Ristorante", 329), own("ah", 189),
      a("jumbo", "Dr. Oetker Ristorante", 319), own("jumbo", 185),
      { store: "lidl", brand: "Trattoria Alfredo", ownBrand: true, priceCents: 159 },
    ],
  },
  {
    id: "frites", name: "Diepvriesfrites 1kg", category: "diepvries", baseUnit: "kg",
    variants: [
      a("ah", "Aviko", 259, 259), own("ah", 165, 165),
      a("jumbo", "Aviko", 249, 249), own("jumbo", 159, 159),
      { store: "lidl", brand: "Harvest Basket", ownBrand: true, priceCents: 139, unitPriceCents: 139 },
    ],
  },
  {
    id: "spinazie-diepvries", name: "Diepvriesspinazie à la crème 450g", category: "diepvries", baseUnit: "kg",
    variants: [
      a("ah", "Iglo", 209, 464), own("ah", 135, 300),
      a("jumbo", "Iglo", 199, 442), own("jumbo", 129, 287),
      { store: "lidl", brand: "Freshona", ownBrand: true, priceCents: 109, unitPriceCents: 242 },
    ],
  },
  {
    id: "roomijs", name: "Roomijs vanille 900ml", category: "diepvries", baseUnit: "litre",
    variants: [
      a("ah", "Ola Carte D'Or", 399, 443), own("ah", 219, 243),
      a("jumbo", "Ola Carte D'Or", 389, 432), own("jumbo", 209, 232),
      { store: "lidl", brand: "Gelatelli", ownBrand: true, priceCents: 179, unitPriceCents: 199 },
    ],
  },
  {
    id: "kipnuggets", name: "Kipnuggets diepvries 400g", category: "diepvries", baseUnit: "kg",
    variants: [
      own("ah", 279, 698),
      own("jumbo", 269, 673),
      { store: "lidl", brand: "Sombrero", ownBrand: true, priceCents: 219, unitPriceCents: 548 },
    ],
  },

  // ─────────────────────────── DRANKEN ───────────────────────────
  {
    id: "jus", name: "Jus d'orange 1L", category: "dranken", baseUnit: "litre",
    variants: [
      own("ah", 189, 189), a("ah", "Appelsientje", 245, 245), a("ah", "Coolbest", 289, 289),
      own("jumbo", 185, 185), a("jumbo", "Appelsientje", 239, 239),
      { store: "lidl", brand: "Solevita", ownBrand: true, priceCents: 155, unitPriceCents: 155 },
    ],
  },
  {
    id: "spa", name: "Bronwater 6x1,5L", category: "dranken", baseUnit: "litre",
    variants: [
      a("ah", "Spa", 449, 50), a("jumbo", "Spa", 439, 49),
      { store: "lidl", brand: "Saskia", ownBrand: true, priceCents: 279, unitPriceCents: 31 },
    ],
  },
  {
    id: "cola", name: "Cola 1,5L", category: "dranken", baseUnit: "litre",
    variants: [
      a("ah", "Coca-Cola", 289, 193), own("ah", 99, 66),
      a("jumbo", "Coca-Cola", 285, 190), own("jumbo", 95, 63),
      { store: "lidl", brand: "Freeway", ownBrand: true, priceCents: 69, unitPriceCents: 46 },
    ],
  },
  {
    id: "appelsap", name: "Appelsap 1L", category: "dranken", baseUnit: "litre",
    variants: [
      own("ah", 149, 149), a("ah", "Appelsientje", 199, 199),
      own("jumbo", 145, 145),
      { store: "lidl", brand: "Solevita", ownBrand: true, priceCents: 119, unitPriceCents: 119 },
    ],
  },
  {
    id: "thee", name: "Zwarte thee 20 zakjes", category: "dranken", baseUnit: "pack",
    variants: [
      a("ah", "Pickwick", 189), own("ah", 89),
      a("jumbo", "Pickwick", 185), own("jumbo", 85),
      { store: "lidl", brand: "Lord Nelson", ownBrand: true, priceCents: 65 },
    ],
  },
  {
    id: "koffie", name: "Koffie snelfilter 500g", category: "dranken", baseUnit: "kg",
    variants: [
      a("ah", "Douwe Egberts", 649, 1298), a("ah", "Kanis & Gunnink", 549, 1098),
      { store: "ah", brand: "Perla", ownBrand: true, priceCents: 419, unitPriceCents: 838 }, // AH-huismerk koffie
      a("jumbo", "Douwe Egberts", 629, 1258), own("jumbo", 399, 798),
      { store: "lidl", brand: "Bellarom", ownBrand: true, priceCents: 349, unitPriceCents: 698 },
    ],
  },
  {
    id: "bier", name: "Pils 6x33cl", category: "dranken", baseUnit: "litre",
    variants: [
      a("ah", "Heineken", 549, 277), a("ah", "Grolsch", 499, 252),
      a("jumbo", "Heineken", 539, 272), a("jumbo", "Grolsch", 489, 247),
      { store: "lidl", brand: "Argus", ownBrand: true, priceCents: 289, unitPriceCents: 146 },
    ],
  },

  // ─────────────────────────── SNACKS & ZOET ───────────────────────────
  {
    id: "chips", name: "Chips naturel 200g", category: "snacks", baseUnit: "kg",
    variants: [
      { store: "ah", brand: "Lay's", ownBrand: false, priceCents: 229, unitPriceCents: 1145, promo: promo(null, "2 voor 3,50") },
      a("ah", "Croky", 219, 1095), own("ah", 145, 725),
      a("jumbo", "Lay's", 219, 1095), a("jumbo", "Croky", 209, 1045), own("jumbo", 139, 695),
      { store: "lidl", brand: "Snack Day", ownBrand: true, priceCents: 99, unitPriceCents: 495 },
    ],
  },
  {
    id: "chocolade", name: "Chocoladereep melk 100g", category: "snacks", baseUnit: "kg",
    variants: [
      a("ah", "Milka", 149, 1490), a("ah", "Tony's Chocolonely", 299, 2990), own("ah", 79, 790),
      a("jumbo", "Milka", 145, 1450), a("jumbo", "Tony's Chocolonely", 289, 2890), own("jumbo", 75, 750),
      { store: "lidl", brand: "Fin Carré", ownBrand: true, priceCents: 65, unitPriceCents: 650 },
    ],
  },
  {
    id: "stroopwafels", name: "Stroopwafels 10 stuks", category: "snacks", baseUnit: "pack",
    variants: [
      a("ah", "Daelmans", 199), own("ah", 145),
      a("jumbo", "Daelmans", 195), own("jumbo", 139),
      { store: "lidl", brand: "Sondey", ownBrand: true, priceCents: 119 },
    ],
  },
  {
    id: "pinda-noten", name: "Gezouten pinda's 250g", category: "snacks", baseUnit: "kg",
    variants: [
      a("ah", "Duyvis", 179, 716), own("ah", 119, 476),
      a("jumbo", "Duyvis", 175, 700), own("jumbo", 115, 460),
      { store: "lidl", brand: "Alesto", ownBrand: true, priceCents: 99, unitPriceCents: 396 },
    ],
  },
  {
    id: "drop", name: "Zoute drop 400g", category: "snacks", baseUnit: "kg",
    variants: [
      a("ah", "Klene", 249, 623), own("ah", 165, 413),
      a("jumbo", "Venco", 239, 598), own("jumbo", 159, 398),
      { store: "lidl", brand: "Sondey", ownBrand: true, priceCents: 129, unitPriceCents: 323 },
    ],
  },

  // ─────────────────────────── PERSOONLIJKE VERZORGING ───────────────────────────
  {
    id: "tandpasta", name: "Tandpasta 75ml", category: "persoonlijke verzorging", baseUnit: "pack",
    variants: [
      a("ah", "Prodent", 149), a("ah", "Sensodyne", 349), own("ah", 89),
      a("jumbo", "Prodent", 145), a("jumbo", "Sensodyne", 339), own("jumbo", 85),
      { store: "lidl", brand: "Dentalux", ownBrand: true, priceCents: 65 },
    ],
  },
  {
    id: "shampoo", name: "Shampoo 300ml", category: "persoonlijke verzorging", baseUnit: "pack",
    variants: [
      a("ah", "Andrélon", 329), a("ah", "Head & Shoulders", 449), own("ah", 129),
      a("jumbo", "Andrélon", 319), own("jumbo", 125),
      { store: "lidl", brand: "Cien", ownBrand: true, priceCents: 99 },
    ],
  },
  {
    id: "douchegel", name: "Douchegel 250ml", category: "persoonlijke verzorging", baseUnit: "pack",
    variants: [
      a("ah", "Dove", 279), own("ah", 99),
      a("jumbo", "Dove", 269), own("jumbo", 95),
      { store: "lidl", brand: "Cien", ownBrand: true, priceCents: 79 },
    ],
  },
  {
    id: "deodorant", name: "Deodorant spray 150ml", category: "persoonlijke verzorging", baseUnit: "pack",
    variants: [
      a("ah", "Nivea", 329), a("ah", "Axe", 349), own("ah", 149),
      a("jumbo", "Nivea", 319), a("jumbo", "Axe", 339),
      { store: "lidl", brand: "Cien", ownBrand: true, priceCents: 115 },
    ],
  },
  {
    id: "toiletpapier", name: "Toiletpapier 8 rollen", category: "persoonlijke verzorging", baseUnit: "pack",
    variants: [
      a("ah", "Page", 449), own("ah", 329),
      a("jumbo", "Page", 439), own("jumbo", 319),
      { store: "lidl", brand: "Floralys", ownBrand: true, priceCents: 279 },
    ],
  },

  // ─────────────────────────── SCHOONMAAK & HUISHOUDEN ───────────────────────────
  {
    id: "wasmiddel", name: "Wasmiddel 1L", category: "schoonmaak", baseUnit: "litre",
    variants: [
      a("ah", "Robijn", 599, 599), own("ah", 399, 399),
      a("jumbo", "Robijn", 579, 579), own("jumbo", 389, 389),
      { store: "lidl", brand: "Formil", ownBrand: true, priceCents: 299, unitPriceCents: 299 },
    ],
  },
  {
    id: "afwasmiddel", name: "Afwasmiddel 500ml", category: "schoonmaak", baseUnit: "litre",
    variants: [
      a("ah", "Dreft", 279, 558), own("ah", 99, 198),
      a("jumbo", "Dreft", 269, 538), own("jumbo", 95, 190),
      { store: "lidl", brand: "W5", ownBrand: true, priceCents: 79, unitPriceCents: 158 },
    ],
  },
  {
    id: "allesreiniger", name: "Allesreiniger 1L", category: "schoonmaak", baseUnit: "litre",
    variants: [
      a("ah", "Glorix", 219, 219), own("ah", 105, 105),
      a("jumbo", "Andy", 209, 209), own("jumbo", 99, 99),
      { store: "lidl", brand: "W5", ownBrand: true, priceCents: 85, unitPriceCents: 85 },
    ],
  },
  {
    id: "vaatwastabletten", name: "Vaatwastabletten 40 stuks", category: "schoonmaak", baseUnit: "pack",
    variants: [
      a("ah", "Sun", 799), a("ah", "Finish", 899), own("ah", 549),
      a("jumbo", "Sun", 789), own("jumbo", 539),
      { store: "lidl", brand: "W5", ownBrand: true, priceCents: 399 },
    ],
  },
  {
    id: "keukenrol", name: "Keukenrol 4 stuks", category: "schoonmaak", baseUnit: "pack",
    variants: [
      a("ah", "Plenty", 449), own("ah", 279),
      a("jumbo", "Plenty", 439), own("jumbo", 269),
      { store: "lidl", brand: "W5", ownBrand: true, priceCents: 229 },
    ],
  },
  {
    id: "vuilniszakken", name: "Vuilniszakken 60L 20 stuks", category: "schoonmaak", baseUnit: "pack",
    variants: [
      own("ah", 249), own("jumbo", 239),
      { store: "lidl", brand: "W5", ownBrand: true, priceCents: 189 },
    ],
  },
];
