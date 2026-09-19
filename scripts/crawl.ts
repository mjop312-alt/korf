// Korf — catalogus-crawler, eenmalig.
//
//   npm run crawl                       alle winkels, volledig assortiment
//   npm run crawl -- --store=ah         één winkel (ah | jumbo | lidl)
//   npm run crawl -- --dry --limit=200  niets opslaan, alleen tonen wat er binnenkomt
//
// Voor continu bijhouden: `npm run worker` (draait dit periodiek per winkel).

import { PrismaClient } from "@prisma/client";
import { crawlStore, STORES } from "../lib/crawl/run";
import type { CrawledProduct, StoreSlug } from "../lib/crawl/types";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
) as Record<string, string>;

const dry = args.dry === "true";
const limit = args.limit ? parseInt(args.limit, 10) : undefined;
const wanted = (args.store ?? "all") === "all" ? STORES : ([args.store] as StoreSlug[]);

const db = new PrismaClient();
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

function describe(all: CrawledProduct[]) {
  const promos = all.filter((p) => p.promo);
  console.log(
    `  ${all.length} producten · ${new Set(all.map((p) => p.brand)).size} merken · ${all.filter((p) => p.ownBrand).length} huismerk · ` +
      `${promos.length} in actie (${promos.filter((p) => p.promo!.priceCents != null).length} met prijs) · ` +
      `${all.filter((p) => p.ean).length} met EAN · ${all.filter((p) => !p.available).length} niet beschikbaar`,
  );
  for (const p of all.slice(0, 3)) console.log("  •", JSON.stringify({ ...p, imageUrl: p.imageUrl ? "…" : null }));
}

async function main() {
  for (const slug of wanted) {
    if (!STORES.includes(slug)) throw new Error(`Onbekende winkel "${slug}" (kies ah, jumbo of lidl)`);
    console.log(`\n▶ ${slug}${dry ? " (dry-run)" : ""}`);
    const collect: CrawledProduct[] = [];
    // één winkel die faalt mag de andere niet blokkeren
    const r = await crawlStore(db, slug, { limit, dry, collect, log: (m) => console.log(`  ${m}`) });
    if (!r.ok) {
      console.error(`✗ ${slug} mislukt: ${r.error}`);
      process.exitCode = 1;
      continue;
    }
    if (dry) {
      describe(collect);
    } else {
      console.log(
        `  ${r.products} producten · ${r.created} nieuw · ${r.changed} prijs/actie gewijzigd · ${r.unchanged} ongewijzigd · ` +
          `${r.promos} acties · ${r.markedGone} uit assortiment · ${secs(r.durationMs)}${r.partial ? " · (gedeeltelijk)" : ""}`,
      );
    }
  }
}

main().finally(() => db.$disconnect());
