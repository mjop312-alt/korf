// Ververst alleen de "hete" producten (lijsten, favorieten, alerts) — zie lib/crawl/hot.ts.
//
//   npm run hot                       alle winkels met een opzoekfunctie
//   npm run hot -- --store=ah --dry   niets opslaan, alleen tellen
//   npm run hot -- --limit=50

import { PrismaClient } from "@prisma/client";
import { HOT_STORES, hotProducts, refreshHot } from "../lib/crawl/hot";
import type { StoreSlug } from "../lib/crawl/types";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
) as Record<string, string>;

const db = new PrismaClient();

async function main() {
  const stores = (args.store ? [args.store] : HOT_STORES) as StoreSlug[];
  const limit = args.limit ? parseInt(args.limit, 10) : undefined;
  for (const s of stores) {
    const sample = (await hotProducts(db, s, 5)).map((i) => i.title);
    const r = await refreshHot(db, s, { limit, dry: args.dry === "true", log: console.log });
    console.log(
      `${s.padEnd(6)} ${r.candidates} hete producten · ${r.found} gevonden · ${r.missing} niet gevonden · ${r.failed} fout · ` +
        `${r.changed} gewijzigd · ${r.unchanged} ongewijzigd · ${r.promos} acties · ${(r.durationMs / 1000).toFixed(1)}s`,
    );
    if (args.verbose === "true") console.log("   voorbeeld:", sample.join(" | "));
  }
}

main().finally(() => db.$disconnect());
