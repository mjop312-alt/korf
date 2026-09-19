// Productgroepen: welke winkelproducten zijn "hetzelfde" en dus vergelijkbaar?
//
// Sleutel = genormaliseerde productnaam ZONDER merk + verpakkingsgrootte, bv.
//   "Campina Halfvolle melk" (1 l)   → halfvolle melk | l1
//   "AH Halfvolle melk"      (1 l)   → halfvolle melk | l1        ← zelfde groep (huismerk)
//   "Jumbo Pindakaas Naturel 600 g"  → naturel pindakaas | kg0.6
//   "AH Pindakaas naturel"   (600 g) → naturel pindakaas | kg0.6  ← zelfde groep, andere winkel
// Een groep bevat dus alle merken én huismerken van hetzelfde soort product in dezelfde
// hoeveelheid, in alle winkels — precies wat de vergelijk-engine als "variants" verwacht.
//
// Bewust conservatief: sub-lijnen die echt iets anders zijn (Biologisch, Excellent, Terra,
// houdbaar, zero) blijven in de naam en houden groepen dus uit elkaar. Liever een gemiste
// match dan een verkeerde.

import { createHash } from "node:crypto";
import { parsePack, type Pack } from "./util";

export interface GroupInput {
  title: string;
  brand: string;
  ownBrand: boolean;
  packLabel: string | null;
  categoryTop: string | null;
}

export interface GroupInfo {
  key: string;
  slug: string;
  name: string;
  baseUnit: "kg" | "litre" | "piece";
  baseSize: number;
  categorySlug: string;
}

/** Eengemaakte categorieën over de winkels heen (AH, Jumbo en Lidl noemen alles anders). */
export const CATEGORIES: { slug: string; name: string; test: RegExp }[] = [
  { slug: "diepvries", name: "Diepvries", test: /diepvries|ijs\b|pizza/ },
  { slug: "groente-fruit", name: "Groente & fruit", test: /groente|fruit|aardappel|salade|paddenstoel/ },
  { slug: "zuivel", name: "Zuivel, kaas & eieren", test: /zuivel|melk|yoghurt|kaas|ei(eren)?\b|boter|room|kwark|vla/ },
  { slug: "vlees-vis", name: "Vlees, vis & vega", test: /vlees|vis\b|vega|kip|gehakt|worst|ham\b|spek|schnitzel|vleeswaren|vegetarisch|plantaardig/ },
  { slug: "brood-bakkerij", name: "Brood & bakkerij", test: /brood|bakkerij|gebak|croissant|broodje|beleg|ontbijt|pindakaas|jam\b|hagelslag|cornflakes|muesli/ },
  { slug: "dranken", name: "Dranken", test: /drank|water|sap|thee|koffie|frisdrank|bier|pils|wijn|aperitief|spirit|limonade|cola/ },
  { slug: "snacks", name: "Snacks & zoet", test: /snack|chips|koek|snoep|chocolade|borrel|noot|noten|tussendoor|zoet|drop|reep/ },
  { slug: "maaltijden", name: "Maaltijden & kruidenier", test: /maaltijd|pasta|rijst|soep|saus|kruid|olie|conserv|wereldkeuken|kant-en-klaar|wraps|bouillon/ },
  { slug: "verzorging", name: "Verzorging & gezondheid", test: /drogisterij|gezondheid|verzorging|baby|shampoo|tandpasta|zeep|luier|vitamine/ },
  { slug: "huishouden", name: "Huishouden", test: /huishoud|schoonmaak|wasmiddel|afwas|toilet|keuken|vuilnis/ },
  { slug: "huisdier", name: "Huisdier", test: /huisdier|hond|kat\b|katten|dierenvoeding/ },
  { slug: "overig", name: "Overig", test: /(?:)/ },
];

/** Bij Lidl ontbreekt de categorie; dan gokken we op basis van de titel. */
export function categoryFor(categoryTop: string | null, title: string): string {
  const hay = fold(`${categoryTop ?? ""} ${categoryTop ? "" : title}`);
  return (CATEGORIES.find((c) => c.test.test(hay)) ?? CATEGORIES[CATEGORIES.length - 1]).slug;
}

// Bij wijn, bier en sterke drank IS het merk (de producent) het product: "Alamos Chardonnay" en
// "19 Crimes Chardonnay" zijn andere wijnen. Daar blijft het merk in de groepssleutel; voor
// melk, pasta en dergelijke is het juist andersom (elk merk is "gewoon halfvolle melk").
const BRAND_MATTERS = /wijn|bier|sterke drank|gedistilleerd|likeur|whisk|jenever|aperitief|spirit/;

const STORE_PREFIX = new Set(["ah", "albert", "heijn", "jumbo", "jumbos", "lidl", "plus", "aldi"]);
const UNIT_WORDS = new Set(["g", "gr", "gram", "kg", "l", "ltr", "liter", "litre", "cl", "ml", "st", "stuks", "stuk", "x"]);
// verpakkingswoorden die niets zeggen over het product zelf
const NOISE = new Set([
  "pak", "pakje", "pakket", "fles", "flesje", "blik", "blikje", "zak", "zakje", "doos", "tray",
  "netje", "bakje", "schaal", "per", "voordeelpak", "voordeelverpakking", "verpakking",
  "multipack", "pack", "verse", "vers", "de", "het", "een", "en", "met", "van", "in",
]);

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " en ")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/['’]s\b/g, "s");
}

function tokens(s: string): string[] {
  return fold(s).match(/[a-z0-9]+(?:\.[0-9]+)?%?/g) ?? [];
}

/** Zoektekst per product: accent-vrij, kleine letters, titel + merk. */
export function searchTextFor(title: string, brand: string): string {
  return fold(`${title} ${brand}`).replace(/\s+/g, " ").trim();
}

/** Zoekwoorden uit een zoekopdracht, op dezelfde manier genormaliseerd als `searchTextFor`. */
export function searchTerms(q: string): string[] {
  return fold(q).match(/[a-z0-9%]+(?:\.[0-9]+)?/g) ?? [];
}

export const isSizeToken = (t: string) => /^\d+(\.\d+)?$/.test(t) || /^\d+(\.\d+)?(g|gr|gram|kg|l|ltr|liter|ml|cl|st|stuks|x)$/.test(t) || UNIT_WORDS.has(t);

const trimNum = (n: number) => String(Math.round(n * 10000) / 10000);

function sizeKey(p: Pack | null): string {
  if (!p) return "x";
  const u = p.unit === "kg" ? "kg" : p.unit === "litre" ? "l" : "st";
  return `${u}${trimNum(p.size)}${p.count > 1 ? `x${p.count}` : ""}`;
}

function unitText(size: number, unit: Pack["unit"]): string {
  if (unit === "kg") return size < 1 ? `${Math.round(size * 1000)} g` : `${trimNum(size)} kg`;
  if (unit === "litre") return size < 1 ? `${Math.round(size * 1000)} ml` : `${trimNum(size)} l`;
  return `${trimNum(size)} stuks`;
}

export function packText(p: Pack | null): string {
  if (!p) return "";
  return p.count > 1 ? `${p.count} × ${unitText(p.size / p.count, p.unit)}` : unitText(p.size, p.unit);
}

const slugify = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function groupFor(p: GroupInput): GroupInfo {
  const pack = parsePack(p.packLabel) ?? parsePack(p.title);

  const brandTokens = new Set(tokens(p.brand));
  const all = tokens(p.title);
  // A-merk: het merk uit de titel halen. Huismerk: alleen "AH"/"Jumbo"/"Lidl" — sub-lijnen
  // als Biologisch, Excellent en Terra zijn écht een ander product.
  const keepBrand = !p.ownBrand && BRAND_MATTERS.test(fold(p.categoryTop ?? ""));
  const withoutBrand = keepBrand ? all : all.filter((t) => (p.ownBrand ? !STORE_PREFIX.has(t) : !brandTokens.has(t)));
  let core = withoutBrand.filter((t) => !isSizeToken(t) && !NOISE.has(t) && t.length > 1);
  // titel == merk ("COCA-COLA"): dan is het merk zelf de enige naam die we hebben
  if (!core.length) core = all.filter((t) => !isSizeToken(t) && !NOISE.has(t) && t.length > 1);
  if (!core.length) core = all.length ? all : ["product"];

  const kept = new Set(core);
  const sorted = [...kept].sort();
  const key = `${sorted.join(" ")}|${sizeKey(pack)}`;

  // weergavenaam: de originele woorden (met accenten) die in de kern zitten
  const words = p.title
    .trim()
    .split(/\s+/)
    .filter((w) => {
      const ts = tokens(w);
      return ts.length > 0 && ts.every((t) => kept.has(t));
    });
  const base = (words.length ? words.join(" ") : sorted.join(" ")).toLowerCase();
  const name = `${base.charAt(0).toUpperCase()}${base.slice(1)}${pack ? ` ${packText(pack)}` : ""}`;

  const sizeSlug = pack
    ? `${pack.unit === "piece" ? `${trimNum(pack.size)}st` : unitText(pack.size, pack.unit).replace(/\s/g, "").replace("×", "x")}`
    : "";
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 6);
  const slug = [slugify(sorted.join(" ")), sizeSlug && slugify(sizeSlug), hash].filter(Boolean).join("-").slice(0, 120);

  return {
    key,
    slug,
    name,
    baseUnit: pack?.unit ?? "piece",
    baseSize: pack?.size ?? 1,
    categorySlug: categoryFor(p.categoryTop, p.title),
  };
}
