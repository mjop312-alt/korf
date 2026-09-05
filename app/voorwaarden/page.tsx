// /voorwaarden — gebruiksvoorwaarden.

import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Voorwaarden — Korf",
  description: "De gebruiksvoorwaarden van Korf: wat je van de prijzen mag verwachten en wat niet.",
};

function Row({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-line py-6 md:grid-cols-[0.9fr_1.4fr] md:gap-10">
      <h3 className="font-display text-lg text-ink">{q}</h3>
      <div className="space-y-3 text-sm leading-relaxed text-muted">{a}</div>
    </div>
  );
}

export default function VoorwaardenPage() {
  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 pb-16 pt-10">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Voorwaarden</p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl font-light leading-tight tracking-tight text-ink">
          Gebruiksvoorwaarden
        </h1>

        <div className="mt-8 rounded-2xl border border-brass bg-brass-wash p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-brass">Let op</p>
          <p className="mt-2 text-sm text-text">
            Korf is een demonstratieproject, geen geregistreerd bedrijf. Deze voorwaarden zijn een
            eerlijke, praktische beschrijving van hoe de app werkt — geen door een jurist opgestelde
            overeenkomst.
          </p>
        </div>

        <section className="mt-10">
          <Row
            q="Wat je van de prijzen mag verwachten"
            a={
              <p>
                Korf toont prijzen zoals opgehaald van de aangesloten bron, met een tijdstempel erbij.
                Zie{" "}
                <Link href="/betrouwbaarheid" className="text-brass underline underline-offset-2">
                  Betrouwbaarheid
                </Link>{" "}
                voor precies wat wel en niet is meegerekend. Prijzen kunnen wijzigen na het moment van
                controleren; Korf geeft geen garantie dat een prijs bij afrekenen nog exact klopt.
              </p>
            }
          />
          <Row
            q="Je account"
            a={
              <p>
                Je bent zelf verantwoordelijk voor je inloggegevens. Gebruik geen wachtwoord dat je ook
                ergens anders gebruikt. Je mag je account op elk moment verwijderen via Instellingen.
              </p>
            }
          />
          <Row
            q="Toegestaan gebruik"
            a={
              <p>
                Korf is bedoeld voor persoonlijk gebruik: je eigen boodschappen vergelijken en delen met
                mensen die je zelf een link geeft. Geen geautomatiseerd overnemen van de inhoud
                (scrapen), geen misbruik van het deel-mechanisme om spam te verspreiden.
              </p>
            }
          />
          <Row
            q="Aansprakelijkheid"
            a={
              <p>
                Korf wordt geleverd zoals hij is, zonder garanties. Gebruik van de app, inclusief elke
                beslissing gebaseerd op getoonde prijzen of besparingen, is op eigen risico.
              </p>
            }
          />
          <Row
            q="Wijzigingen"
            a={
              <p>
                Omdat Korf een actief project in ontwikkeling is, kunnen functies en deze voorwaarden
                veranderen. Belangrijke wijzigingen proberen we zichtbaar te maken in de app.
              </p>
            }
          />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
