// /over — wat Korf is, voor wie, en de huidige status van het project.

import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Over Korf — Korf",
  description: "Wat Korf is, waarom het bestaat, en de huidige status van het project.",
};

function Row({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-line py-6 md:grid-cols-[0.9fr_1.4fr] md:gap-10">
      <h3 className="font-display text-lg text-ink">{q}</h3>
      <div className="space-y-3 text-sm leading-relaxed text-muted">{a}</div>
    </div>
  );
}

export default function OverPage() {
  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />

      <main id="main-content" className="mx-auto max-w-5xl px-6 pb-16 pt-10">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Over Korf</p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl font-light leading-tight tracking-tight text-ink">
          Eén boodschappenlijst, elke supermarktprijs ernaast.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Korf vergelijkt je boodschappenlijst over meerdere supermarkten en laat in centen zien wat
          je bespaart — zonder dat je zelf prijzen hoeft na te zoeken.
        </p>

        <section className="mt-10">
          <Row
            q="Wat is Korf?"
            a={
              <p>
                Je maakt één lijst; Korf rekent 'm door bij elke aangesloten supermarkt en zet er drie
                strategieën naast — <strong>goedkoopste winkel</strong>, <strong>beste balans</strong> (hooguit
                2 winkels) en <strong>maximaal splitsen</strong>. Je kiest, en Korf onthoudt wat je
                bespaarde.
              </p>
            }
          />
          <Row
            q="Status van het project"
            a={
              <p>
                Korf is een persoonlijk/demonstratieproject in ontwikkeling, geen geregistreerd bedrijf.
                Zie <Link href="/betrouwbaarheid" className="text-brass underline underline-offset-2">Betrouwbaarheid</Link>{" "}
                voor precies welke winkels op dit moment live data leveren en welke nog demodata tonen.
              </p>
            }
          />
          <Row
            q="Hoe werkt de vergelijking?"
            a={
              <p>
                De uitleg met een doorgerekend voorbeeld staat op{" "}
                <Link href="/hoe-het-werkt" className="text-brass underline underline-offset-2">Hoe het werkt</Link>.
              </p>
            }
          />
          <Row
            q="Contact"
            a={
              <p>
                Vragen, bugs of ideeën? Er is nog geen support-kanaal ingericht voor dit project — kijk
                voor nu op de broncode-repository van Korf.
              </p>
            }
          />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
