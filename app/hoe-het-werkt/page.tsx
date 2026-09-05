// /hoe-het-werkt — uitleg voor een eerste bezoeker: de stappen, de drie
// winkelstrategieën (met een echt doorgerekend voorbeeld), en praktische vragen.
// Server component, statisch.

import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { compareList, formatEuro } from "@/lib/compare";
import { CATALOG, SUPERMARKETS } from "@/lib/mock-data";
import type { ListItem } from "@/lib/types";

export const metadata: Metadata = {
  title: "Hoe het werkt — Korf",
  description:
    "Van boodschappenlijst tot besparing in drie stappen. Uitleg van de drie winkelstrategieën met een echt doorgerekend voorbeeld.",
};

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

export default function HoeHetWerktPage() {
  const r = compareList(EXAMPLE, CATALOG, SUPERMARKETS, {
    storeIds: SUPERMARKETS.map((s) => s.id),
    maxStoresBalanced: 2,
  });

  const steps = [
    {
      n: "01",
      t: "Stel je lijst samen",
      d: "Zoek een product en voeg het toe — losse termen (‘6 eieren’) mogen ook. Pas aantal en eenheid aan, deel op in categorieën, sla favorieten op. Je kunt meerdere lijsten aanhouden, bijvoorbeeld een vaste weeklijst.",
    },
    {
      n: "02",
      t: "Kies per regel of het merk uitmaakt",
      d: "Standaard pakt Korf het goedkoopste passende product. Wil je per se Calvé? Zet het merk vast. Altijd huismerk? Kies ‘alleen huismerk’. Je ziet de opties die bij je gekozen winkels bestaan.",
    },
    {
      n: "03",
      t: "Kies welke supermarkten meedoen",
      d: "Vul je postcode in en vink de winkels in de buurt aan. Die selectie wordt je standaard; per lijst pas je ’m aan.",
    },
    {
      n: "04",
      t: "Vergelijk",
      d: "Korf zet de prijs per product naast elkaar en rekent drie manieren door om je lijst te halen. De laagste prijs staat in het groen, aanbiedingen krijgen een label.",
    },
    {
      n: "05",
      t: "Kies je scenario en doe boodschappen",
      d: "Ga voor de goedkoopste winkel, de beste balans of maximaal splitsen. Vink af tijdens het winkelen; je besparing telt mee in je maandoverzicht.",
    },
  ];

  const scenarioRows = [
    {
      key: "cheapestSingle" as const,
      naam: "Goedkoopste winkel",
      uitleg: "Alles bij één supermarkt — de goedkoopste die je héle lijst heeft. Eén keer boodschappen doen.",
      s: r.cheapestSingle,
    },
    {
      key: "balanced" as const,
      naam: "Beste balans",
      uitleg: "Het praktische compromis: hooguit 2 winkels, en alleen splitsen als de besparing dat echt waard is.",
      s: r.balanced,
    },
    {
      key: "maxSplit" as const,
      naam: "Maximaal splitsen",
      uitleg: "Elk product bij de winkel waar dát product het goedkoopst is. Laagste totaalprijs, maar mogelijk meerdere winkels.",
      s: r.maxSplit,
    },
  ];

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />

      <main id="main-content" className="mx-auto max-w-5xl px-6 pb-16 pt-10">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Hoe het werkt</p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl font-light leading-tight tracking-tight text-ink">
          Van boodschappenlijst tot besparing, in vijf stappen.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Je hoeft niets te installeren en geen prijzen bij te houden. Jij maakt de lijst,
          Korf doet het rekenwerk.
        </p>

        {/* stappen */}
        <section className="mt-14 space-y-0">
          {steps.map((step) => (
            <div key={step.n} className="grid gap-3 border-t border-line py-7 md:grid-cols-[64px_1fr] md:gap-8">
              <span className="font-display text-2xl font-light text-brass">{step.n}</span>
              <div>
                <h2 className="font-display text-xl text-ink">{step.t}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{step.d}</p>
              </div>
            </div>
          ))}
        </section>

        {/* de drie scenario's — met echt voorbeeld */}
        <section className="mt-16 rounded-3xl border border-line bg-raised p-6 sm:p-10">
          <h2 className="font-display text-3xl font-light text-ink">De drie winkelstrategieën</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            Dit is de kern van Korf. Hieronder een <strong>echt doorgerekend</strong> voorbeeld op
            demodata: een lijst van {EXAMPLE.length} producten, vergeleken over Albert Heijn, Jumbo en Lidl.
          </p>

          {/* per winkel */}
          <div className="mt-8 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="font-mono text-[0.62rem] uppercase tracking-wider text-muted">
                  <th className="py-2 pr-4 text-left font-medium">Alles bij één winkel</th>
                  <th className="py-2 text-right font-medium">Totaal</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {r.complete.map((c, i) => (
                  <tr key={c.storeId} className="border-t border-line/60">
                    <td className={`py-2 pr-4 ${i === 0 ? "text-sage" : "text-text"}`}>
                      {storeName(c.storeId)}{i === 0 ? " — goedkoopste" : ""}
                    </td>
                    <td className={`py-2 text-right tabular-nums ${i === 0 ? "text-sage" : "text-text"}`}>
                      {formatEuro(c.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* scenario-kaarten */}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {scenarioRows.map(({ key, naam, uitleg, s }) => (
              <div
                key={key}
                className={`flex flex-col rounded-2xl border p-5 ${r.recommended === key ? "border-brass bg-brass-wash" : "border-line bg-ground"}`}
              >
                <p className={`font-mono text-[0.6rem] uppercase tracking-widest ${r.recommended === key ? "text-brass" : "text-muted"}`}>
                  {r.recommended === key ? "Aanbevolen" : " "}
                </p>
                <h3 className="mt-1 font-display text-lg text-ink">{naam}</h3>
                {s ? (
                  <>
                    <p className="mt-2 font-mono text-2xl font-medium text-ink tabular-nums">{formatEuro(s.totalCents)}</p>
                    <p className="font-mono text-xs text-sage">
                      {s.savingCents > 0 ? `bespaart ${formatEuro(s.savingCents)}` : "referentie"}
                    </p>
                    <p className="mt-1 text-xs text-muted">{s.storeIds.map(storeName).join(" + ")}</p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-muted">n.v.t. voor deze lijst</p>
                )}
                <p className="mt-4 text-xs leading-relaxed text-muted">{uitleg}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-muted">
            De besparing is het verschil met de duurste “hoofdwinkel” ({r.referenceLabel}). Hoe Korf
            aan prijzen komt en wat er niet is meegerekend, staat op{" "}
            <Link href="/betrouwbaarheid" className="text-brass underline underline-offset-2">Betrouwbaarheid</Link>.
          </p>
        </section>

        {/* praktische vragen */}
        <section className="mt-16">
          <h2 className="font-display text-3xl font-light text-ink">Praktisch</h2>
          <div className="mt-8 grid gap-x-10 gap-y-7 md:grid-cols-2">
            {[
              ["Kost het geld?", "Nee. Korf is gratis te gebruiken en toont een onafhankelijk overzicht — geen supermarkt betaalt voor een betere plek."],
              ["Heb ik een account nodig?", "Om te vergelijken niet. Een account heb je alleen nodig om je lijsten en je besparingsteller te bewaren."],
              ["Welke supermarkten?", "In deze versie Albert Heijn, Jumbo en Lidl (demodata). De opzet is gemaakt om later Plus, Dirk, Aldi, Coop, Picnic en meer toe te voegen."],
              ["Zijn de prijzen actueel?", "In deze demo niet — het zijn realistische voorbeeldprijzen. Bij elke prijs staat straks wanneer die voor het laatst is gecontroleerd."],
              ["Kan ik een lijst delen?", "Ja. Je kunt een lijst opslaan, dupliceren en delen; de ontvanger krijgt een kopie of een alleen-lezen link."],
              ["Werkt het op mijn telefoon?", "Ja, mobiel is de hoofdvorm. Onderin zie je altijd je lopende totaal en de knop om te vergelijken."],
            ].map(([q, a]) => (
              <div key={q}>
                <h3 className="font-display text-lg text-ink">{q}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="mt-16 flex flex-col items-start gap-4 rounded-3xl border border-line bg-sunken p-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-2xl font-light text-ink">Klaar om je eerste lijst te maken?</p>
          <Link href="/lijst" className="whitespace-nowrap rounded-xl bg-ink px-6 py-3.5 font-medium text-ground">
            Maak een boodschappenlijst
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
