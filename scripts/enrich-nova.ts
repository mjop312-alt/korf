// Haalt de bewerkingsgraad (NOVA 1–4) per barcode op bij Open Food Facts (open database, ODbL) en
// bewaart die in `ProductNova`. Hervatbaar: wat al gecontroleerd is wordt overgeslagen.
//
//   npm run enrich-nova                  alles wat nog niet gecontroleerd is
//   npm run enrich-nova -- --limit=500   alleen de eerste 500
//
// Beleefd: OFF vraagt max. 100 verzoeken/minuut voor losse producten — we doen er ~80, met een
// herkenbare User-Agent. Alleen ~1 op 3 producten staat in OFF en slechts ~1 op 9 heeft een
// NOVA-score; de rest wordt als "gecontroleerd, geen score" bewaard (nova = NULL).

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const UA = "Korf/0.1 (hobbyproject; github.com/mjop312-alt/korf)";
const DELAY_MS = 750;
const BATCH = 200;

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
const limit = args.limit ? parseInt(args.limit, 10) : Infinity;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** null = onbekend bij OFF of geen score; "retry" = tijdelijk probleem, niet bewaren. */
async function lookup(ean: string): Promise<number | null | "retry"> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=nova_group`, { headers: { "User-Agent": UA } });
    if (res.status === 404) return null;
    if (res.status === 429 || res.status >= 500) return "retry";
    if (!res.ok) return null;
    const j = (await res.json()) as { product?: { nova_group?: number | string } };
    const n = Number(j.product?.nova_group);
    return n >= 1 && n <= 4 ? n : null;
  } catch {
    return "retry";
  }
}

async function main() {
  let done = 0, withScore = 0, strikes = 0;
  const t0 = Date.now();
  while (done < limit) {
    // gangbare producten (in meerdere winkels) eerst: die zie je het vaakst
    const rows = await db.$queryRaw<{ ean: string }[]>`
      SELECT sp.ean FROM "StoreProduct" sp
      WHERE sp.available AND sp.ean IS NOT NULL AND sp.ean <> ''
        AND NOT EXISTS (SELECT 1 FROM "ProductNova" n WHERE n.ean = sp.ean)
      GROUP BY sp.ean ORDER BY COUNT(DISTINCT sp."supermarketId") DESC, sp.ean
      LIMIT ${Math.min(BATCH, limit - done)}`;
    if (!rows.length) break;

    for (const { ean } of rows) {
      const nova = await lookup(ean);
      if (nova === "retry") {
        if (++strikes >= 8) {
          console.log("Te veel tijdelijke fouten achter elkaar (Open Food Facts overbelast?) — stop; later opnieuw draaien hervat vanzelf.");
          return;
        }
        await sleep(30_000 * strikes); // oplopende pauze
        continue;
      }
      strikes = 0;
      await db.$executeRaw`INSERT INTO "ProductNova" (ean, nova) VALUES (${ean}, ${nova}) ON CONFLICT (ean) DO UPDATE SET nova = EXCLUDED.nova, "checkedAt" = now()`;
      done++;
      if (nova) withScore++;
      if (done % 200 === 0) {
        const rate = done / ((Date.now() - t0) / 60_000);
        console.log(`${done} gecontroleerd · ${withScore} met NOVA-score · ${rate.toFixed(0)}/min`);
      }
      await sleep(DELAY_MS);
    }
  }
  console.log(`Klaar: ${done} gecontroleerd, ${withScore} met NOVA-score.`);
}

main().finally(() => db.$disconnect());
