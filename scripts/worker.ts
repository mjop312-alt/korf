// Korf — worker: houdt de catalogus, prijzen en acties vers door elke winkel periodiek
// volledig te crawlen. Laat dit draaien naast (of los van) de website:
//
//   npm run worker                          alle winkels, continu
//   npm run worker -- --stores=ah,jumbo     alleen deze winkels
//   npm run worker -- --once                elke winkel één keer en dan stoppen (voor cron/tests)
//   npm run worker -- --verbose             ook per-categorie-voortgang tonen
//
// Ritme (minuten tussen twee rondes, instelbaar in .env):
//   CRAWL_INTERVAL_AH_MIN=15   CRAWL_INTERVAL_JUMBO_MIN=30   CRAWL_INTERVAL_LIDL_MIN=60
//
// Waarom geen 5 minuten voor alles? Geen enkele winkel heeft een "alleen aanbiedingen"-route
// (getest), dus elke verversing is een volledige ronde: AH ≈ 350 verzoeken (~2–3 min), Jumbo
// ≈ 1.000 (~4 min), Lidl ≈ 95 langzame verzoeken (~4 min). Continu opnieuw scannen op een
// onofficiële API werkt blokkades in de hand; prijzen veranderen bovendien hooguit een paar
// keer per dag. Wil je toch sneller, zet het interval lager — op eigen risico.

import { PrismaClient } from "@prisma/client";
import { crawlStore, STORES, type RunResult } from "../lib/crawl/run";
import type { StoreSlug } from "../lib/crawl/types";
import { sleep } from "../lib/crawl/util";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
) as Record<string, string>;

const once = args.once === "true";
const verbose = args.verbose === "true";
const limit = args.limit ? parseInt(args.limit, 10) : undefined;
const wanted = (args.stores ?? "all") === "all" ? STORES : (args.stores.split(",") as StoreSlug[]);

const DEFAULT_MIN: Record<StoreSlug, number> = { ah: 15, jumbo: 30, lidl: 60 };
const intervalMs = (slug: StoreSlug) => {
  const v = parseInt(process.env[`CRAWL_INTERVAL_${slug.toUpperCase()}_MIN`] ?? "", 10);
  return (Number.isFinite(v) && v > 0 ? v : DEFAULT_MIN[slug]) * 60_000;
};

const db = new PrismaClient();
let stopping = false;

const stamp = () => new Date().toLocaleTimeString("nl-NL");
const say = (slug: string, msg: string) => console.log(`${stamp()} [${slug}] ${msg}`);
const fmtMin = (ms: number) => (ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)} s`);

/** Slaapt, maar wordt wakker zodra we moeten stoppen. */
async function nap(ms: number) {
  for (let left = ms; left > 0 && !stopping; left -= 1000) await sleep(Math.min(1000, left));
}

async function runLoop(slug: StoreSlug, startDelayMs: number): Promise<boolean> {
  await nap(startDelayMs);
  let fails = 0;
  let allOk = true;

  while (!stopping) {
    const t0 = Date.now();
    say(slug, "ronde gestart");
    // Ook een onbereikbare database (of een ontbrekende seed) mag de worker niet laten
    // crashen: dat telt als een mislukte ronde met terugval, niet als het einde.
    const r = await crawlStore(db, slug, { limit, log: verbose ? (m) => say(slug, `  ${m}`) : undefined }).catch(
      (e): RunResult => ({
        store: slug,
        ok: false,
        partial: false,
        products: 0,
        created: 0,
        changed: 0,
        unchanged: 0,
        promos: 0,
        markedGone: 0,
        durationMs: Date.now() - t0,
        error: e instanceof Error ? e.message.split("\n").filter(Boolean).pop() : String(e),
      }),
    );

    if (r.ok) {
      fails = 0;
      say(
        slug,
        `klaar in ${fmtMin(r.durationMs)}: ${r.products} producten · ${r.created} nieuw · ${r.changed} gewijzigd · ` +
          `${r.promos} acties · ${r.markedGone} uit assortiment${r.partial ? " · gedeeltelijk" : ""}`,
      );
    } else {
      fails++;
      allOk = false;
      say(slug, `MISLUKT (${fails}× op rij): ${r.error}`);
    }
    if (once) break;

    // na een fout oplopend wachten (5, 10, 20… max 60 min); na succes de rest van het interval
    const wait = r.ok
      ? Math.max(30_000, intervalMs(slug) - (Date.now() - t0))
      : Math.min(60 * 60_000, 5 * 60_000 * 2 ** (fails - 1));
    say(slug, `volgende ronde over ${fmtMin(wait)}`);
    await nap(wait);
  }
  return allOk;
}

async function main() {
  for (const s of wanted) if (!STORES.includes(s)) throw new Error(`Onbekende winkel "${s}"`);
  console.log(
    `${stamp()} Worker gestart: ` +
      wanted.map((s) => `${s} elke ${fmtMin(intervalMs(s))}`).join(" · ") +
      (once ? " (eenmalig)" : "") +
      "\n           Stoppen: Ctrl+C (de lopende ronde wordt afgemaakt)",
  );

  const stop = () => {
    if (stopping) process.exit(1); // tweede Ctrl+C: meteen weg
    stopping = true;
    console.log(`${stamp()} Stoppen na de lopende ronde… (nogmaals Ctrl+C om meteen te stoppen)`);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  // winkels verspreid starten, zodat ze niet allemaal tegelijk de database bestormen
  const results = await Promise.all(wanted.map((s, i) => runLoop(s, once ? 0 : i * 30_000)));
  if (once && results.some((ok) => !ok)) process.exitCode = 1;
}

main().finally(() => db.$disconnect());
