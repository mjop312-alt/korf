// Soepeler zoeken: vage/informele woorden ("wc-spul", "afwas") laten net zo goed treffers geven
// als de exacte productnaam ("toiletreiniger", "vaatwastabletten"). Twee simpele lagen, geen AI:
//
//  1. FILLER — woorden die niets over het product zeggen ("spul", "ding") tellen niet mee als
//     verplicht woord, zodat "wc spul" hetzelfde zoekt als "wc".
//  2. SYNONYMS — een kort, met de hand samengesteld rijtje veelgebruikte omschrijvingen die als
//     alternatief meetellen naast het letterlijke woord (OR, niet vervangend).
//
// Bewust een kleine, onderhoudbare lijst — uit te breiden zodra een zoekopdracht niets oplevert
// die dat wel had moeten doen (zie /producten "niets gevonden").

const FILLER = new Set([
  "spul",
  "spullen",
  "spulletjes",
  "ding",
  "dingen",
  "product",
  "producten",
  "artikel",
  "artikelen",
  "iets",
  "wat",
  "goedje",
]);

const SYNONYMS: Record<string, string[]> = {
  wc: ["toilet"],
  toilet: ["wc"],
  afwas: ["vaat", "vaatwas"],
  vaat: ["afwas"],
  fris: ["frisdrank"],
  bubbels: ["prosecco", "cava", "champagne"],
  wasmiddel: ["wasmachine"],
  vuilnis: ["afval", "vuilniszak"],
  afvalzak: ["vuilniszak"],
  tissues: ["zakdoekjes"],
  zakdoekjes: ["tissues"],
  luiers: ["luier"],
  scheren: ["scheermesjes", "scheerschuim"],
  tandenpoetsen: ["tandpasta", "tandenborstel"],
  ontbijtkoek: ["peperkoek"],
  frisdrank: ["fris"],
  chips: ["borrelnoten", "snacks"],
  borrel: ["chips", "noten", "borrelnoten"],
  toetje: ["dessert", "pudding"],
  dessert: ["toetje"],
  beleg: ["broodbeleg"],
  vlaflip: ["vla"],
  jus: ["jus-d'orange", "sinaasappelsap"],
  koffiemelk: ["koffiecreamer"],
  afspoelen: ["wasverzachter"],
  gebit: ["tandpasta"],
  bakspul: ["bakmeel", "bloem"],
};

/** Vouwt query-woorden om naar OR-alternatieven per woord (filler woorden vallen weg). */
export function expandSearchWords(tokens: string[]): string[][] {
  const kept = tokens.filter((t) => !FILLER.has(t));
  const use = kept.length ? kept : tokens; // niet alles laten vallen als er alleen fillerwoorden zijn
  return use.map((t) => [t, ...(SYNONYMS[t] ?? [])]);
}
