// / — Homepage. Server component (statisch). Rustige hero, geen carrousel.
// De voorbeeldbesparing is écht doorgerekend met de engine op demodata.

import Link from "next/link";
import { ProductTile } from "@/components/product-tile";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { compareList, formatEuro } from "@/lib/compare";
import { CATALOG, SUPERMARKETS } from "@/lib/mock-data";
import type { ListItem } from "@/lib/types";

const EXAMPLE: ListItem[] = [
  { id: "1", productId: "melk", quantity: 2, brandMode: "any" },
  { id: "2", productId: "koffie", quantity: 1, brandMode: "any" },
  { id: "3", productId: "chips", quantity: 2, brandMode: "any" },
  { id: "4", productId: "wasmiddel", quantity: 1, brandMode: "any" },
  { id: "5", productId: "jus", quantity: 1, brandMode: "any" },
  { id: "6", productId: "roomboter", quantity: 1, brandMode: "any" },
  { id: "7", productId: "pindakaas", quantity: 1, brandMode: { brand: "Calvé" } },
  { id: "8", productId: "kipfilet", quantity: 1, brandMode: "any" },
];

const storeName = (id: string) => SUPERMARKETS.find((s) => s.id === id)?.name ?? id;

export default function Home() {
  const r = compareList(EXAMPLE, CATALOG, SUPERMARKETS, {
    storeIds: SUPERMARKETS.map((s) => s.id),
    maxStoresBalanced: 2,
  });
  const best = r.balanced ?? r.cheapestSingle;
  const bestSaving = best?.savingCents ?? 0;

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />

      {/* ── hero ── */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Prijsvergelijker voor Nederlandse boodschappen
          </p>
          <h1 className="mt-5 font-display text-4xl font-light leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Van je boodschappen<br />elke maand geld terug.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">
            Jij legt je vaste lijst aan. Korf houdt bij wat de slimste verdeling over de
            supermarkten je scheelt — en toont dat als één bedrag per maand.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/lijst" className="rounded-xl bg-ink px-6 py-3.5 font-medium text-ground">
              Maak een boodschappenlijst
            </Link>
            <Link href="/vergelijk" className="rounded-xl border border-line px-6 py-3.5 font-medium text-ink hover:bg-raised">
              Bekijk een voorbeeld
            </Link>
          </div>
          <p className="mt-4 font-mono text-xs text-muted">
            Demodata — geen actuele prijzen. <Link href="/betrouwbaarheid" className="text-brass underline underline-offset-2">Hoe Korf aan data komt</Link>
          </p>
        </div>

        {/* preview: kassabon + besparing */}
        <div className="rounded-3xl border border-line bg-raised p-6 shadow-sm sm:p-8">
          <div className="flex items-baseline justify-between font-mono text-[0.65rem] uppercase tracking-widest text-muted">
            <span>Voorbeeldlijst · {EXAMPLE.length} producten</span>
            <span>Kassabon</span>
          </div>
          <div className="mt-4 space-y-1.5 font-mono text-sm">
            {r.complete.map((c, i) => (
              <div key={c.storeId} className={`flex justify-between ${i === 0 ? "text-sage" : "text-text"}`}>
                <span>{i === 0 ? "→ " : ""}{storeName(c.storeId)}</span>
                <span className="tabular-nums">{formatEuro(c.totalCents)}</span>
              </div>
            ))}
            {best && (
              <div className="flex justify-between border-t border-dashed border-line pt-2 font-bold text-ink">
                <span>Slim verdeeld{best.storeIds.length > 1 ? ` (${best.storeIds.length} winkels)` : ""}</span>
                <span className="tabular-nums">{formatEuro(best.totalCents)}</span>
              </div>
            )}
          </div>
          <div className="mt-6 rounded-2xl bg-sage-wash p-4">
            <div className="font-mono text-3xl font-medium text-sage tabular-nums">{formatEuro(bestSaving)}</div>
            <p className="mt-1 text-xs text-muted">
              bespaard op deze lijst t.o.v. {r.referenceLabel} — × 4 lijsten ≈ {formatEuro(bestSaving * 4)} per maand
            </p>
          </div>
        </div>
      </section>

      {/* ── vertrouwensrij ── */}
      <section className="border-y border-line bg-raised">
        <div className="mx-auto grid max-w-6xl gap-px bg-line sm:grid-cols-3">
          {[
            ["Actuele prijsinzichten", "Elke prijs met datum van laatste controle. Verouderd? Dan een waarschuwing."],
            ["Slimme vergelijkingen", "Niet losse deals, maar je hele lijst — één totaal, één beslissing."],
            ["Onafhankelijk overzicht", "Geen supermarkt betaalt voor een betere plek. De rangschikking volgt de prijs."],
          ].map(([t, d]) => (
            <div key={t} className="bg-raised px-6 py-8">
              <h3 className="font-display text-lg text-ink">{t}</h3>
              <p className="mt-2 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── zo werkt het ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-3xl font-light text-ink">In drie stappen</h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {[
            ["01", "Lijst maken", "Zoek en voeg producten toe. Kies per regel of het merk uitmaakt of niet."],
            ["02", "Vergelijken", "Korf rekent drie scenario’s door: goedkoopste winkel, beste balans, maximaal splitsen."],
            ["03", "Besparen", "Kies je scenario, doe boodschappen, en zie je besparing oplopen."],
          ].map(([n, t, d]) => (
            <div key={n} className="border-t border-line pt-4">
              <span className="font-mono text-xs text-brass">{n}</span>
              <h3 className="mt-2 font-display text-xl text-ink">{t}</h3>
              <p className="mt-2 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── voorbeeldbesparing (echt doorgerekend) ── */}
      <section className="border-y border-line bg-sunken">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">Voorbeeld · demodata</p>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-light text-ink">
            Dezelfde lijst, drie manieren om ’m te halen.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { label: "Goedkoopste winkel", s: r.cheapestSingle, key: "cheapestSingle" as const },
              { label: "Beste balans", s: r.balanced, key: "balanced" as const },
              { label: "Maximaal splitsen", s: r.maxSplit, key: "maxSplit" as const },
            ].map(({ label, s, key }) => (
              <div
                key={label}
                className={`rounded-2xl border p-5 ${r.recommended === key ? "border-brass bg-brass-wash" : "border-line bg-raised"}`}
              >
                <p className={`font-mono text-[0.6rem] uppercase tracking-widest ${r.recommended === key ? "text-brass" : "text-muted"}`}>
                  {r.recommended === key ? "Aanbevolen" : " "}
                </p>
                <h3 className="mt-1 font-display text-lg text-ink">{label}</h3>
                {s ? (
                  <>
                    <p className="mt-2 font-mono text-2xl font-medium text-ink tabular-nums">{formatEuro(s.totalCents)}</p>
                    <p className="mt-1 font-mono text-xs text-sage">
                      {s.savingCents > 0 ? `bespaart ${formatEuro(s.savingCents)}` : "referentie"}
                    </p>
                    <p className="mt-2 text-xs text-muted">{s.storeIds.map(storeName).join(" + ")}</p>
                  </>
                ) : (
                  <p className="mt-3 text-xs text-muted">n.v.t.</p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {EXAMPLE.slice(0, 6).map((it) => {
              const p = CATALOG.find((c) => c.id === it.productId)!;
              const brand = typeof it.brandMode === "object" ? it.brandMode.brand : null;
              return <ProductTile key={it.id} product={p} brand={brand} size={44} />;
            })}
            <span className="font-mono text-xs text-muted">+ {EXAMPLE.length - 6} meer</span>
          </div>
        </div>
      </section>

      {/* ── voordelen ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-3xl font-light text-ink">Voor wie bewust boodschappen doet</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            ["Gezinnen", "Een volle weeklijst telt aan. Zie per maand wat de slimme verdeling oplevert."],
            ["Studenten & jongvolwassenen", "Klein budget, scherpe prijzen. Snel de goedkoopste route zonder folders spitten."],
            ["Multi-supermarkt shoppers", "Al gewend om te splitsen? Korf zegt of het die extra rit echt waard is."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-line bg-raised p-6">
              <h3 className="font-display text-lg text-ink">{t}</h3>
              <p className="mt-2 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── afsluit-CTA ── */}
      <section className="border-t border-line bg-ink text-ground">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-3xl font-light">Zie wat je bespaart, voordat je de deur uit gaat.</h2>
          <Link href="/lijst" className="whitespace-nowrap rounded-xl bg-ground px-6 py-3.5 font-medium text-ink">
            Maak een boodschappenlijst
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
