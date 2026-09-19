// Rooktest: haalt de belangrijkste pagina's en API's van een draaiende app op en controleert
// status + een herkenbaar stuk inhoud. Geen inlog nodig.
//
//   npm run dev        (in een andere terminal)
//   npm run smoke      (of: npm run smoke -- http://localhost:3001)

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

interface Check {
  path: string;
  expect?: RegExp;
  reject?: RegExp;
  method?: "GET" | "POST";
  body?: unknown;
  status?: number;
}

const checks: Check[] = [
  { path: "/", expect: /Korf|korf/ },
  { path: "/producten", expect: /productgroepen/ },
  { path: "/producten?q=halfvolle+melk", expect: /Halfvolle melk/i },
  { path: "/producten?q=zzzzqqq", expect: /Niets gevonden/ },
  { path: "/producten?categorie=zuivel&winkel=plus&soort=own&sorteer=price" },
  { path: "/producten?actie=1&pagina=2" },
  { path: "/aanbiedingen", expect: /aanbiedingen/i, reject: /demodata/i },
  { path: "/aanbiedingen?winkel=aldi&categorie=zuivel" },
  { path: "/betrouwbaarheid", expect: /Albert Heijn[\s\S]*Aldi[\s\S]*PLUS/, reject: /demodata/i },
  { path: "/vergelijk", expect: /Vergelijking/ },
  { path: "/lijst", expect: /Je lijst/ },
  { path: "/hoe-het-werkt" },
  { path: "/over" },
  { path: "/privacy" },
  { path: "/voorwaarden" },
  { path: "/robots.txt" },
  { path: "/sitemap.xml", expect: /<urlset/ },
  { path: "/api/products/search?q=&limit=2", expect: /"cards":\[\{/ },
  { path: "/api/products/search?q=pindakaas&limit=3&variants=1", expect: /"products":\[\{/ },
  { path: "/api/compare", method: "POST", body: { items: [], storeIds: [] }, status: 200 },
  { path: "/api/compare", method: "POST", body: { items: [{ productId: "x", quantity: 1 }], storeIds: ["ah"] }, status: 422 },
  { path: "/dashboard", status: 200 }, // zonder sessie: redirect naar /inloggen (fetch volgt die)
  { path: "/inloggen", expect: /Inloggen/ },
  { path: "/bestaat-niet", status: 404 },
];

async function firstProductSlug(): Promise<string | null> {
  try {
    const r = await fetch(`${base}/api/products/search?q=melk&minStores=2&limit=1`, { signal: AbortSignal.timeout(120_000) });
    const j = (await r.json()) as { cards?: { slug: string }[] };
    return j.cards?.[0]?.slug ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const slug = await firstProductSlug();
  if (slug) checks.push({ path: `/product/${slug}`, expect: /Prijs per winkel/ });
  else console.log("⚠ geen product gevonden voor /product/<slug>");

  let failed = 0;
  for (const c of checks) {
    const t0 = Date.now();
    let msg = "";
    try {
      const res = await fetch(base + c.path, {
        method: c.method ?? "GET",
        headers: c.body ? { "Content-Type": "application/json" } : undefined,
        body: c.body ? JSON.stringify(c.body) : undefined,
        signal: AbortSignal.timeout(120_000),
      });
      const text = await res.text();
      const want = c.status ?? 200;
      if (res.status !== want) msg = `status ${res.status}, verwacht ${want}`;
      else if (c.expect && !c.expect.test(text)) msg = `mist ${c.expect}`;
      else if (c.reject && c.reject.test(text)) msg = `bevat ${c.reject}`;
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
    }
    const ms = Date.now() - t0;
    if (msg) failed++;
    console.log(`${msg ? "✗" : "✓"} ${(c.method ?? "GET").padEnd(4)} ${c.path.padEnd(58)} ${String(ms).padStart(6)} ms${msg ? "  ← " + msg : ""}`);
  }
  console.log(failed ? `\n${failed} van ${checks.length} mislukt` : `\nAlle ${checks.length} controles geslaagd`);
  process.exitCode = failed ? 1 : 0;
}

main();
