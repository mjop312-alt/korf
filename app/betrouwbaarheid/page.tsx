// /betrouwbaarheid — hoe Korf aan data komt, wat wel en niet is meegerekend,
// en de huidige status (mock vs. live). Server component, statisch.

import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { SUPERMARKETS } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Betrouwbaarheid — Korf",
  description:
    "Waar Korf zijn prijzen vandaan haalt, hoe actueel ze zijn, wat wel en niet is meegerekend, en hoe de besparing wordt berekend.",
};

// Weerspiegelt DATA_MODE (zie lib/providers/index.ts) — "live" betekent dat de
// ingestion-worker (npm run ingest) écht bij AH/Jumbo/Lidl heeft opgehaald.
const isLive = process.env.DATA_MODE === "live";
const DATA_STATUS = SUPERMARKETS.map((s) => ({
  name: s.name,
  mode: (isLive ? "live" : "demo") as "demo" | "live",
  note: isLive
    ? "onofficiële zoek-API, periodiek opgehaald — geen bonuskaart-/winkelspecifieke prijzen"
    : "voorbeeldprijzen, niet actueel",
}));

function Row({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-line py-6 md:grid-cols-[0.9fr_1.4fr] md:gap-10">
      <h3 className="font-display text-lg text-ink">{q}</h3>
      <div className="space-y-3 text-sm leading-relaxed text-muted">{a}</div>
    </div>
  );
}

export default function BetrouwbaarheidPage() {
  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 pb-16 pt-10">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Betrouwbaarheid</p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl font-light leading-tight tracking-tight text-ink">
          Wat je van Korf mag verwachten — en wat niet.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Korf laat zien wat je bespaart. Die belofte is alleen iets waard als je weet hoe de
          bedragen tot stand komen. Daarom leggen we het hier volledig uit.
        </p>

        {/* huidige status */}
        <div className="mt-10 rounded-2xl border border-brass bg-brass-wash p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-brass">Huidige status</p>
          <p className="mt-2 text-sm text-text">
            {isLive ? (
              <>
                Deze versie haalt <strong>echte prijzen</strong> op bij Albert Heijn, Jumbo en Lidl via
                hun (onofficiële) zoek-API's. Geen bonuskaart- of winkelspecifieke kortingen, en
                matching gebeurt op trefwoord — af en toe kan dat een net iets andere variant treffen.
              </>
            ) : (
              <>
                Deze versie draait volledig op <strong>demodata</strong>. De prijzen zijn realistisch
                gekozen, maar <strong>niet actueel</strong> en niet van een supermarkt afkomstig. Zodra
                een echte databron is aangesloten, verdwijnt deze melding voor die winkel.
              </>
            )}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="font-mono text-[0.62rem] uppercase tracking-wider text-muted">
                  <th className="py-2 pr-4 text-left font-medium">Supermarkt</th>
                  <th className="py-2 pr-4 text-left font-medium">Bron</th>
                  <th className="py-2 text-left font-medium">Toelichting</th>
                </tr>
              </thead>
              <tbody>
                {DATA_STATUS.map((d) => (
                  <tr key={d.name} className="border-t border-brass/30">
                    <td className="py-2 pr-4 text-ink">{d.name}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[0.6rem] uppercase ${
                          d.mode === "demo" ? "border-brass text-brass" : "border-sage text-sage"
                        }`}
                      >
                        {d.mode === "demo" ? "Demodata" : "Live"}
                      </span>
                    </td>
                    <td className="py-2 text-muted">{d.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* uitleg */}
        <section className="mt-14">
          <Row
            q="Waar komen de prijzen vandaan?"
            a={
              <>
                <p>
                  In productie leest Korf prijzen uit <strong>officiële API&rsquo;s en partnerfeeds</strong>{" "}
                  van de supermarkten, aangevuld met handmatige controle. Een achtergrondproces haalt
                  ze periodiek op en zet ze in onze database — de website doet nooit tijdens jouw
                  bezoek een verzoek aan een supermarkt.
                </p>
                <p>
                  Korf <strong>scrapet geen websites</strong> in strijd met hun voorwaarden en omzeilt
                  geen beveiliging. Kan een bron niet meer, dan schakelen we die winkel uit in plaats
                  van door te gaan op oude data.
                </p>
              </>
            }
          />
          <Row
            q="Hoe actueel is een prijs?"
            a={
              <>
                <p>
                  Bij elke prijs staat wanneer die voor het laatst is gecontroleerd. Is een prijs
                  ouder dan de drempel (standaard 24 uur), dan verschijnt een{" "}
                  <strong>verouderd-waarschuwing</strong> en telt die winkel niet zomaar als
                  &ldquo;goedkoopste&rdquo; zonder jouw bevestiging.
                </p>
              </>
            }
          />
          <Row
            q="Wat is níét meegerekend?"
            a={
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Bonuskaart- en Extra-kortingen.</strong> Korf rekent met de schapprijs
                  online/landelijk. Persoonlijke kortingen kunnen je totaal verlagen.
                </li>
                <li>
                  <strong>Fysieke winkelprijzen.</strong> Die kunnen afwijken van de webshop.
                </li>
                <li>
                  <strong>1+1 gratis, 2e halve prijs, cashback.</strong> Deze tonen we als label met
                  geldigheidsdatum, maar verrekenen we niet automatisch in de prijs. Een kale
                  prijskorting (&ldquo;nu €0,99&rdquo;) tellen we wél mee.
                </li>
                <li>
                  <strong>Statiegeld</strong> en bezorgkosten (tenzij je bezorging aanzet in je
                  instellingen).
                </li>
              </ul>
            }
          />
          <Row
            q="Verschillende verpakkingsgroottes"
            a={
              <p>
                Merken en formaten verschillen per winkel. Korf normaliseert naar een{" "}
                <strong>prijs per kilo, liter of stuk</strong> en toont die altijd naast de
                schapprijs, zodat &ldquo;Calvé 350 g&rdquo; en &ldquo;huismerk 600 g&rdquo; eerlijk
                naast elkaar komen.
              </p>
            }
          />
          <Row
            q="Aanbiedingen zijn tijdelijk"
            a={
              <p>
                Elke actie toont zijn geldigheidsperiode. Een scenario dat leunt op een aanbieding
                geldt dus alleen zolang die loopt.
              </p>
            }
          />
          <Row
            q="Beschikbaarheid verschilt per locatie"
            a={
              <p>
                Assortiment, prijs en bezorging kunnen per regio verschillen. Vul je postcode in,
                dan rekent Korf met de winkels in jouw buurt; anders met landelijke online-prijzen.
              </p>
            }
          />
          <Row
            q="Hoe wordt de besparing berekend?"
            a={
              <>
                <p>
                  Korf rekent drie manieren door om je lijst te halen: <strong>goedkoopste winkel</strong>,{" "}
                  <strong>beste balans</strong> (hooguit 2 winkels) en <strong>maximaal splitsen</strong>.
                  De besparing is het verschil tussen de gekozen manier en de duurste
                  &ldquo;hoofdwinkel&rdquo; — alles daar halen, gaten vullen bij de goedkoopste andere
                  winkel. Nooit een negatief bedrag.
                </p>
                <p>
                  Op de vergelijkpagina kun je precies uitklappen hoe een totaal is opgebouwd.{" "}
                  <Link href="/vergelijk" className="text-brass underline underline-offset-2">
                    Bekijk een voorbeeld
                  </Link>
                  .
                </p>
              </>
            }
          />
          <Row
            q="En je privacy?"
            a={
              <p>
                Korf werkt met je <strong>postcode</strong>, niet je adres. Je lijsten en prijsalerts
                zijn van jou; je kunt je gegevens exporteren en je account verwijderen in de
                instellingen. We bouwen geen persoonlijke prijsprofielen.
              </p>
            }
          />
        </section>

        <p className="mt-12 border-t border-line pt-6 text-sm text-muted">
          Vragen over een specifieke prijs of bron? Dat hoort straks bij{" "}
          <Link href="/over" className="text-brass underline underline-offset-2">Over Korf</Link>.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
