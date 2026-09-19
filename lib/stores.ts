// De echte winkels waarvan Korf de catalogus ophaalt (zie lib/crawl). De seed zet ze in de
// database; de meeste schermen lezen ze vanaf daar. `lib/mock-data.ts` heeft een eigen, kleinere
// lijst voor de voorbeeldbesparing en de tests.

import type { Supermarket } from "./types";

export const STORES: Supermarket[] = [
  { id: "ah", name: "Albert Heijn", short: "AH", brandColor: "#0A7DB8" },
  { id: "jumbo", name: "Jumbo", short: "Jumbo", brandColor: "#C9770A" },
  { id: "lidl", name: "Lidl", short: "Lidl", brandColor: "#1C4E9C" },
  { id: "aldi", name: "Aldi", short: "Aldi", brandColor: "#00A0DD" },
  { id: "plus", name: "PLUS", short: "PLUS", brandColor: "#3AA935" },
];
