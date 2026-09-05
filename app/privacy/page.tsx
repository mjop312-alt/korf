// /privacy — privacyverklaring. Zie ook /instellingen (privacy-tab: export + account
// verwijderen) en /betrouwbaarheid (data-bronnen).

import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Privacy — Korf",
  description: "Welke gegevens Korf bewaart, waarom, en hoe je ze kunt inzien of verwijderen.",
};

function Row({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-line py-6 md:grid-cols-[0.9fr_1.4fr] md:gap-10">
      <h3 className="font-display text-lg text-ink">{q}</h3>
      <div className="space-y-3 text-sm leading-relaxed text-muted">{a}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />

      <main id="main-content" className="mx-auto max-w-5xl px-6 pb-16 pt-10">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Privacy</p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl font-light leading-tight tracking-tight text-ink">
          Wat Korf van je bewaart — en wat niet.
        </h1>

        <div className="mt-8 rounded-2xl border border-brass bg-brass-wash p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-brass">Let op</p>
          <p className="mt-2 text-sm text-text">
            Korf is een demonstratieproject, geen geregistreerd bedrijf. Deze pagina beschrijft eerlijk
            wat de app op dit moment doet en bewaart — het is geen door een jurist opgestelde
            privacyverklaring en biedt geen formele AVG-garanties.
          </p>
        </div>

        <section className="mt-10">
          <Row
            q="Welke gegevens bewaart Korf?"
            a={
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Je account: e-mailadres, naam (optioneel), en een gehasht wachtwoord.</li>
                <li>Je boodschappenlijsten, lijstregels, merkkeuzes en winkelselectie.</li>
                <li>Je voorkeuren: postcode-straal, gekozen winkels, meldingsinstellingen.</li>
                <li>Prijsalerts die je zelf instelt, en favoriete producten.</li>
                <li>Een geschiedenis van afgeronde boodschappentrips (bedrag + besparing), voor je besparingsoverzicht.</li>
              </ul>
            }
          />
          <Row
            q="Waarvoor gebruiken we dat?"
            a={
              <p>
                Uitsluitend om Korf voor jou te laten werken: je lijst tonen, prijzen vergelijken, je
                besparing berekenen en bijhouden, en je te waarschuwen bij een prijsalert. Korf bouwt
                geen advertentieprofiel en verkoopt geen gegevens aan derden.
              </p>
            }
          />
          <Row
            q="Cookies en tracking"
            a={
              <p>
                Korf gebruikt één functionele sessiecookie om je ingelogd te houden (via Auth.js).
                Er zit geen advertentie- of trackingcookie in, en geen cookiebanner nodig omdat er
                niets te kiezen valt buiten die ene functionele cookie.
              </p>
            }
          />
          <Row
            q="Locatie"
            a={
              <p>
                Korf werkt met een <strong>postcode</strong> die je zelf invult, niet met je exacte
                adres of GPS-locatie. Die postcode bepaalt welke winkels in de buurt worden getoond.
              </p>
            }
          />
          <Row
            q="Delen met anderen"
            a={
              <p>
                Een lijst delen doe je zelf, via een link met een willekeurige token. Iedereen met die
                link kan de lijst zien (en, afhankelijk van de gekozen modus, naar zijn eigen lijsten
                kopiëren) — Korf plaatst niets automatisch openbaar.
              </p>
            }
          />
          <Row
            q="Inzien, exporteren en verwijderen"
            a={
              <p>
                Onder{" "}
                <Link href="/instellingen?tab=privacy" className="text-brass underline underline-offset-2">
                  Instellingen → Privacy
                </Link>{" "}
                kun je al je gegevens als JSON downloaden of je account en alle lijsten definitief
                verwijderen.
              </p>
            }
          />
          <Row
            q="Bewaartermijn"
            a={
              <p>
                Zolang je account bestaat. Verwijder je je account, dan verdwijnen je lijsten,
                voorkeuren, alerts en besparingsgeschiedenis direct mee.
              </p>
            }
          />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
