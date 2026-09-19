// Korf — EAN's ophalen voor Albert Heijn-producten.
//
//   npm run enrich-ean                  alle AH-merkproducten zonder EAN (huismerken slaan we over)
//   npm run enrich-ean -- --limit=200   test met 200
//   npm run enrich-ean -- --own         ook huismerken meenemen
//
// AH geeft de EAN niet in de zoekresultaten, wél in het product-detail (`gtin`). Met de EAN
// kunnen AH- en Jumbo-producten EXACT aan elkaar gekoppeld worden, in plaats van op titel te
// gokken ("Heinz Beanz" ↔ "Heinz Beanz Tomatensaus 415 g"). Eén verzoek per product, dus dit
// draait rustig (±6 verzoeken per seconde) en is hervatbaar: wat al een EAN heeft (of bekend
// is als "geen EAN", opgeslagen als lege tekst) wordt overgeslagen.

import { PrismaClient } from "@prisma/client";
import { ahHeaders } from "../lib/crawl/ah";
import { fetchJson, normalizeEan, sleep } from "../lib/crawl/util";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
) as Record<string, string>;

const limit = args.limit ? parseInt(args.limit, 10) : Infinity;
const includeOwn = args.own === "true";
const CONCURRENCY = 3;
const DELAY_MS = 200; // per worker, na elk verzoek
const CHUNK = 300;

const db = new PrismaClient();
let stopping = false;
process.on("SIGINT", () => {
  if (stopping) process.exit(1);
  stopping = true;
  console.log("Stoppen na dit blok… (nogmaals Ctrl+C om meteen te stoppen)");
});

/** Zoekt de eerste "gtin" (string of array) ergens in het detail-antwoord. */
function findGtin(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (/^gtins?$/i.test(k)) {
      const first = Array.isArray(v) ? v[0] : v;
      if (typeof first === "string" || typeof first === "number") return String(first);
    }
  }
  for (const v of Object.values(node as Record<string, unknown>)) {
    const f = findGtin(v);
    if (f) return f;
  }
  return null;
}

async function fetchEan(externalId: string): Promise<string | null> {
  try {
    const j = await fetchJson<unknown>(
      `https://api.ah.nl/mobile-services/product/detail/v4/fir/${externalId}`,
      { headers: await ahHeaders() },
      { label: `AH detail ${externalId}`, retries: 3 },
    );
    return normalizeEan(findGtin(j));
  } catch (e) {
    // 404 = product bestaat niet meer/geen detail: bekend als "geen EAN"
    if (e instanceof Error && /HTTP 404/.test(e.message)) return null;
    throw e;
  }
}

async function main() {
  const [{ n: todo }] = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM "StoreProduct" sp
    JOIN "Supermarket" s ON s.id = sp."supermarketId" JOIN "Brand" b ON b.id = sp."brandId"
    WHERE s.slug = 'ah' AND sp."externalId" IS NOT NULL AND sp.ean IS NULL AND (${includeOwn} OR NOT b."isOwnBrand")`;
  const total = Math.min(todo, limit);
  console.log(`AH-producten zonder EAN: ${todo}${includeOwn ? "" : " (alleen merkproducten)"} — nu ${total}`);

  const t0 = Date.now();
  let done = 0;
  let found = 0;
  let failed = 0;

  let lastId = ""; // cursor: mislukte producten blijven NULL en mogen niet steeds opnieuw aan de beurt komen
  while (!stopping && done < total) {
    const rows = await db.$queryRaw<{ id: string; ext: string }[]>`
      SELECT sp.id, sp."externalId" AS ext FROM "StoreProduct" sp
      JOIN "Supermarket" s ON s.id = sp."supermarketId" JOIN "Brand" b ON b.id = sp."brandId"
      WHERE s.slug = 'ah' AND sp."externalId" IS NOT NULL AND sp.ean IS NULL AND (${includeOwn} OR NOT b."isOwnBrand")
        AND sp.id > ${lastId}
      ORDER BY sp.id LIMIT ${Math.min(CHUNK, total - done)}`;
    if (!rows.length) break;
    lastId = rows[rows.length - 1].id;

    const results = new Map<string, string>(); // id → ean of "" (geen)
    let next = 0;
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (!stopping) {
          const i = next++;
          if (i >= rows.length) return;
          try {
            const ean = await fetchEan(rows[i].ext);
            results.set(rows[i].id, ean ?? "");
            if (ean) found++;
          } catch {
            failed++; // tijdelijke fout: laten liggen voor een volgende run
          }
          await sleep(DELAY_MS);
        }
      }),
    );

    const ids = [...results.keys()];
    if (ids.length) {
      await db.$executeRaw`
        UPDATE "StoreProduct" sp SET ean = t.ean
        FROM unnest(${ids}::text[], ${ids.map((id) => results.get(id)!)}::text[]) AS t(id, ean)
        WHERE sp.id = t.id AND sp.ean IS NULL`;
    }
    done += rows.length;
    const secs = (Date.now() - t0) / 1000;
    const rate = done / secs;
    console.log(
      `${done}/${total} · ${found} EAN's gevonden · ${failed} mislukt · ${rate.toFixed(1)}/s · nog ~${Math.round((total - done) / rate / 60)} min`,
    );
    if (failed > 0 && failed / done > 0.3) throw new Error("Te veel mislukte verzoeken — gestopt (mogelijk geblokkeerd)");
  }
  console.log(stopping ? "Gestopt." : "Klaar.");
}

main().finally(() => db.$disconnect());
