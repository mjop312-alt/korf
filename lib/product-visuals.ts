// Korf — product-visuals. In productie toont de UI de echte productfoto
// (StoreProduct.imageUrl per variant, CanonicalProduct.imageUrl als fallback).
// Zolang die er niet zijn — of in de demo — tonen we een nette tegel:
// categorie-glyph + merknaam + merk-accent, die meeverandert met de merkkeuze.

import type { BrandMode, CanonicalProduct, ListItem, StoreId } from "./types";

/** Minimaal wat een tegel nodig heeft — zodat je 'm ook kunt voeden met een losse rij. */
export type TileProduct = Pick<CanonicalProduct, "id" | "name" | "category">;

const CATEGORY_EMOJI: Record<string, string> = {
  "groente & fruit": "🥬", zuivel: "🥛", "vlees & vis": "🍗",
  "brood & bakkerij": "🥖", "brood & beleg": "🫙", diepvries: "❄️",
  dranken: "🥤", snacks: "🍫", "persoonlijke verzorging": "🧴", schoonmaak: "🧽",
};

const PRODUCT_EMOJI: Record<string, string> = {
  melk: "🥛", eieren: "🥚", roomboter: "🧈", yoghurt: "🥣", vla: "🍮", "jonge-kaas": "🧀",
  slagroom: "🥛", kwark: "🥣", halvarine: "🧈",
  bananen: "🍌", appels: "🍎", trostomaten: "🍅", komkommer: "🥒", paprika: "🫑",
  ijsbergsla: "🥬", wortelen: "🥕", uien: "🧅", sinaasappels: "🍊", aardappelen: "🥔",
  champignons: "🍄", avocado: "🥑",
  kipfilet: "🍗", gehakt: "🥩", rundergehakt: "🥩", spekreepjes: "🥓", zalmfilet: "🐟", vegaburger: "🍔",
  brood: "🍞", bolletjes: "🥐", croissants: "🥐", crackers: "🍘", beschuit: "🍘",
  pindakaas: "🥜", hagelslag: "🍫", jam: "🍓", chocopasta: "🍫", "kipfilet-vleeswaren": "🍗",
  pizza: "🍕", frites: "🍟", "spinazie-diepvries": "🥬", roomijs: "🍨", kipnuggets: "🍗",
  jus: "🍊", spa: "💧", cola: "🥤", appelsap: "🧃", thee: "🍵", koffie: "☕", bier: "🍺",
  chips: "🥔", chocolade: "🍫", stroopwafels: "🧇", "pinda-noten": "🥜", drop: "🍬",
  tandpasta: "🪥", shampoo: "🧴", douchegel: "🧴", deodorant: "💨", toiletpapier: "🧻",
  wasmiddel: "🧴", afwasmiddel: "🧴", allesreiniger: "🧴", vaatwastabletten: "🧼",
  keukenrol: "🧻", vuilniszakken: "🗑️",
};

export function glyphFor(product: TileProduct): string {
  return PRODUCT_EMOJI[product.id] ?? CATEGORY_EMOJI[product.category] ?? "🛒";
}

const BRAND_ACCENT: Record<string, string> = {
  Calvé: "#d23b2e", AH: "#1f8bc7", Jumbo: "#e0a021", Lidl: "#1f5cb0", Milbona: "#1f8bc7",
  Campina: "#1f66b5", "Lay's": "#e0a021", Croky: "#c8102e", "Coca-Cola": "#c8121a",
  Nutella: "#6b3b23", "Douwe Egberts": "#a5201f", Perla: "#8a6a3a", "De Ruijter": "#7a4a2a",
  Venz: "#c8102e", Robijn: "#3a6fb0", Heineken: "#187a44", Grolsch: "#187a44", Spa: "#4a86c4",
  Milka: "#7a68a8", "Tony's Chocolonely": "#d4142b", Nivea: "#1f5cb0", Dove: "#2e6db4",
  Iglo: "#1f66b5", "Dr. Oetker Ristorante": "#b01a1a", Chiquita: "#1f66b5", Pickwick: "#7a4a2a",
  Duyvis: "#c8102e", Klene: "#5a3a8a", Venco: "#444", Sensodyne: "#1f8bc7", Aviko: "#e0a021",
  Bellarom: "#5a4433", "Kanis & Gunnink": "#7a4a2a", Kroon: "#7a4a2a", "Fin Carré": "#6b3b23",
  Formil: "#1f5cb0", "Snack Day": "#e0a021", Solevita: "#e0a021", Freeway: "#c8121a",
  Saskia: "#4a86c4", "Blue Band": "#1f8bc7", Bolletje: "#c8102e", WASA: "#c8102e",
  Vivera: "#4a8a3a", "Bonne Maman": "#b8455a", Hero: "#c8102e", Daelmans: "#7a4a2a",
  Sondey: "#7a4a2a", Alesto: "#5a4433", "Arla Skyr": "#1f66b5", Beemster: "#1f66b5",
  Page: "#4a86c4", Plenty: "#1f8bc7", Sun: "#e0a021", Finish: "#1f5cb0", Dreft: "#1f8bc7",
  Andy: "#187a44", Glorix: "#1f8bc7", Pikok: "#c8102e", W5: "#1f8bc7", Cien: "#7a68a8",
};
const FALLBACK = ["#6b6a58", "#5f7355", "#8a6a3a", "#7a5a6a", "#4a6a7a", "#7a6a4a", "#5a5a7a"];

export function accentFor(brand: string | null): string {
  if (!brand) return "#8f8a78";
  if (BRAND_ACCENT[brand]) return BRAND_ACCENT[brand];
  let h = 0;
  for (let i = 0; i < brand.length; i++) h = (h * 31 + brand.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}

/** Welk merk de tegel toont: het vastgezette merk, anders de goedkoopste in scope. */
export function tileBrandFor(
  item: Pick<ListItem, "productId" | "brandMode">,
  catalog: CanonicalProduct[],
  storeIds: StoreId[],
): { brand: string | null } {
  const mode: BrandMode = item.brandMode;
  if (typeof mode === "object") return { brand: mode.brand };
  const product = catalog.find((c) => c.id === item.productId);
  if (!product) return { brand: null };
  const eff = (p: { priceCents: number; promo?: { priceCents: number | null } }) =>
    p.promo && p.promo.priceCents != null ? p.promo.priceCents : p.priceCents;
  const inScope = product.variants
    .filter((v) => storeIds.includes(v.store) && (mode !== "own" || v.ownBrand))
    .sort((x, y) => eff(x) - eff(y));
  return { brand: inScope[0]?.brand ?? null };
}
