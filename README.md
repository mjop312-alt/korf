# Korf — werkende kern (fase 4)

Premium prijs- en aanbiedingenvergelijker voor Nederlandse boodschappen.
Dit is de **kern uit fase 4**: de geverifieerde scenario-engine, mockdata, een API-route
en twee werkende schermen. Het merkconcept, de blauwdruk en de architectuur staan in de
bijbehorende documenten (fase 1–3).

> **Alle prijzen zijn demodata.** Geen actuele data. In productie vult de ingestion-worker
> PostgreSQL met prijzen uit officiële bronnen, elk met een `collected_at`.

## Draaien

```bash
npm install            # draait ook 'prisma generate'
cp .env.example .env    # (of gebruik de meegeleverde .env)
npm run db:push        # maakt de lokale SQLite-database (prisma/dev.db)
npm run db:seed        # vult 'm met de mockdata + een demo-account
npm run dev            # http://localhost:3000
```

Node 20+ (getest op Node 24).

**Demo-login:** `demo@korf.nl` / `demo1234`

### Handige scripts

| Script | Wat |
| --- | --- |
| `npm test` / `npm run typecheck` | Vitest (21) / `tsc --noEmit` |
| `npm run db:reset` | schema opnieuw + opnieuw seeden (wist alles) |
| `npm run db:studio` | Prisma Studio — de database bekijken |
| `npm run ingest` | ingestion-worker: providers → database (nu MockProvider) |

## Fundering (M0)

| Pad | Wat |
| --- | --- |
| `prisma/schema.prisma` | Volledig datamodel. **Lokaal SQLite**, portabel geschreven; voor productie → `provider = "postgresql"` + Neon/Supabase-URL + `prisma migrate`. |
| `prisma/seed.ts` | Zet `lib/mock-data.ts` in de DB + demo-account met voorbeeldlijst. |
| `lib/db.ts` | Prisma-client singleton. |
| `auth.ts` / `auth.config.ts` / `middleware.ts` | Auth.js v5 — e-mail/wachtwoord-login, JWT-sessies, `/dashboard` · `/lijsten` · `/instellingen` afgeschermd. |
| `app/inloggen` · `app/registreren` · `app/api/auth/*` | Login- en registratieschermen + endpoints. |
| `lib/providers/*` + `scripts/ingest.ts` | `PriceProvider`-interface + `MockProvider` + de ingestion-worker. Echte connectors implementeren `PriceProvider`. |

## Lijsten (M1)

| Pad | Wat |
| --- | --- |
| `lib/lists.ts` / `lib/list-actions.ts` / `lib/list-map.ts` | Lees-queries, server-actions (CRUD + regels), DB↔engine-mapping + lijstsjablonen. |
| `components/list-builder.tsx` | Herbruikbare samensteller (props + callbacks). |
| `app/lijst/page.tsx` | Ingelogd → door naar je actieve lijst; uitgelogd → gast-samensteller (zonder opslaan). |
| `app/lijst/[id]/` | Persistente editor: hernoemen, actief maken, dupliceren, archiveren, lijst-switcher. |
| `app/lijsten/page.tsx` | Overzicht: nieuwe lijst (leeg of sjabloon), per lijst acties, gearchiveerd. |
| `/vergelijk?lijst=<id>` | Vergelijkt je eigen lijst uit de database. |

## Vergelijken (M2)

| Pad | Wat |
| --- | --- |
| `lib/catalog-db.ts` | Bouwt de engine-invoer (`CanonicalProduct[]` + prijzen + `collectedAt`) uit de **database**, gecachet (60s). `/api/compare` en `/vergelijk` draaien hierop. `freshnessLabel()` → "x geleden" + stale-vlag (> 24 u). |
| `lib/compare.ts` | `Scenario` bevat nu `assignment` (per regel → winkel), voor de bon en de tabel-highlight. |
| `app/vergelijk/` | ScenarioSwitcher (`?scenario=` in de URL), besparingsopbouw (referentie − gekozen = bespaard), kassabon met kopieer-knop, kaart per winkel met versheid, product-voor-product met salie-highlight op de gekozen winkel, stale-waarschuwing. |

> Na `npm run ingest` of `npm run db:seed` is de vergelijk-catalogus max 60 s oud (cache). Herstart `npm run dev` om het meteen te zien. Een `db:seed`/`db:reset` maakt bestaande login-sessies ongeldig (nieuwe user-id's) — log opnieuw in.

## Ontdekken (M3)

| Pad | Wat |
| --- | --- |
| `lib/offers.ts` | Queries voor aanbiedingen, productdetail (prijzen per winkel + alternatieven) en prijshistorie (laagste per dag per winkel). |
| `components/price-history-chart.tsx` | Handgetekende SVG-lijngrafiek (geen chartlib), theme-aware, met legenda nu/laagst/gemiddeld. |
| `lib/alerts.ts` / `lib/alert-actions.ts` / `components/price-alert-control.tsx` | Prijsalerts: "waarschuw me onder €…", instellen/verwijderen. |
| `app/aanbiedingen/page.tsx` | Filterbaar op winkel + categorie, kaart per aanbieding, "+ naar lijst", link naar detail. |
| `app/product/[slug]/page.tsx` | Header + laagste prijs, prijs per winkel met versheid, prijsverloop-grafiek, prijsalert, alternatieven. |
| `prisma/seed.ts` | Genereert ~15 wekelijkse prijs-momentopnames per winkelproduct voor de grafiek. |

## Locatie & afwerking (M4)

| Pad | Wat |
| --- | --- |
| `app/dashboard/page.tsx` | Na inloggen: statistiekrij (live doorgerekend op je actieve lijst), recente lijsten, favorieten, prijsalerts, snelle acties. |
| `app/instellingen/page.tsx` | Tabs: locatie · winkels · voorkeuren · meldingen · privacy · account. `lib/preference-actions.ts`. |
| `app/onboarding/page.tsx` | Postcode + straal + winkels in de buurt aanvinken → dashboard. Nieuwe accounts komen hier. |
| `lib/favorites.ts` | Favoriet-toggle op productpagina, sectie op het dashboard. |
| `app/api/me/export/route.ts` | Download al je gegevens als JSON (privacy-tab). |
| `lib/providers/ah.ts` | **Echte Albert Heijn-connector** (token-auth + zoeken + `listAll` met trefwoord-matching). Actief bij `DATA_MODE=live`. |

Voorkeuren werken door: `minExtraStoreSavingCents` gaat mee in `/vergelijk` + `/api/compare`, `defaultBrandMode` bepaalt de merkkeuze van nieuwe lijstregels.

## Delen & afvinken (na M4)

| Pad | Wat |
| --- | --- |
| `lib/shares.ts` | `getShareByToken()` — leesquery voor de publieke deelpagina, incl. verlooptijd-check. |
| `lib/list-actions.ts` | `createShare` (mode `read`/`copy`, token via `crypto.randomUUID()`), `revokeShares`, `copySharedList` (kopieert een gedeelde lijst naar je eigen lijsten). |
| `components/share-list-dialog.tsx` | Knop op de lijst-editor: kies leesmodus of kopieermodus → genereert `/gedeeld/<token>`, kopieerbaar. |
| `app/gedeeld/[token]/page.tsx` | Publieke deelpagina (geen login nodig om te bekijken). Bij `copy`-modus: knop "kopieer naar mijn lijsten" (login vereist). |
| `app/lijst/[id]/doen/page.tsx` + `components/shopping-checklist.tsx` | "Boodschappen doen"-modus: het gekozen vergelijk-scenario als afvinklijst, gegroepeerd per winkel, met voortgangsbalk en "afgevinkte producten weghalen". Aan te roepen vanaf `/vergelijk` zodra je een scenario hebt gekozen. |
| `lib/use-action-queue.ts` | **Belangrijk voor toekomstig werk.** Er zat een bug: snel-achter-elkaar rechtstreeks (niet via `<form action>`) aangeroepen server-acties konden elkaar overschrijven — alleen de eerste schrijfactie persisteerde, ondanks HTTP 200 op alle requests. Root cause zat in Next.js' server-action-dispatch, niet in Prisma/SQLite (bevestigd met een losstaand script buiten Next om). Fix: `useActionQueue()` rijgt acties in een promise-keten zodat er nooit twee tegelijk in-flight zijn. Toegepast in `shopping-checklist.tsx` en `list-editor.tsx`. **Gebruik deze hook in elk nieuw component dat server-acties rechtstreeks (niet via een `<form>`) en mogelijk snel na elkaar aanroept.** |

## Wat zit erin

| Pad | Wat |
| --- | --- |
| `lib/types.ts` | Kern-datatypes. Bedragen in hele centen. |
| `lib/compare.ts` | **De scenario-engine.** Pure functies, geen I/O. Scenario A / B / C + besparing. |
| `lib/mock-data.ts` | 65 canonieke producten over 9 categorieën × 3 supermarkten, met A-merken + huismerken en acties. Elke winkel draagt alleen de merken die zij echt verkoopt; Lidl heeft bewust een aantal assortimentsgaten. |
| `lib/catalog.ts` | Merkkeuze-helpers: `availableBrands` / `brandChoiceOptions` / `isBrandModeAvailable` — filteren merken op de aangevinkte winkels. |
| `lib/product-visuals.ts` + `components/product-tile.tsx` | Placeholder-productafbeelding (categorie-glyph + merk + merk-tint) die meeverandert met de merkkeuze. In productie vervangt `<img src={imageUrl}>` deze tegel. |
| `lib/compare.test.ts` | Vitest — 20 testgevallen (promoties, merkvoorkeur, winkel-afhankelijke merken, randgevallen). |
| `app/api/compare/route.ts` | `POST /api/compare` → draait de engine op de mockdata. |
| `app/vergelijk/page.tsx` | Server component: scenario’s + product-voor-product, winkelselectie in de URL. |
| `app/vergelijk/store-selector.tsx` | Client component: `?winkels=` bijwerken → RSC herberekent. |
| `app/lijst/page.tsx` | Client component: lijst samenstellen, merkkeuze per regel, live vergelijking. |
| `app/globals.css` | Korf design-tokens als Tailwind v4 `@theme`. |

De volledige premium-UI (micro-interacties, kassabon, responsive detail) staat als
één losstaand HTML-bestand in de demo-artifact — dit is de framework-kern eronder.

## De engine — hoe A/B/C werkt

1. **Kandidaat per item × winkel.** Respecteert de merkvoorkeur van de regel:
   `any` (goedkoopste passende product), een vastgezet merk, of `own` (alleen huismerk).
   De merkkeuze-opties zijn winkel-afhankelijk (`lib/catalog.ts`): een merk dat alleen
   bij een niet-gekozen winkel bestaat, is geen optie.
   Een kale prijskorting telt mee; een “2 voor 3,50” blijft label (niet verrekend).
2. **Scenario A — goedkoopste winkel.** Alleen winkels die de héle lijst hebben.
3. **Scenario B — maximaal splitsen.** Elk item bij zijn goedkoopste winkel, over zoveel
   winkels als nodig. Alleen productprijzen — géén reiskosten meegerekend.
4. **Scenario C — beste balans.** Greedy: start bij de winnaar van A en verplaats items
   naar een tweede winkel, maar open die tweede winkel alleen als het minstens
   `minExtraStoreSavingCents` scheelt (default 200 = €2). Hooguit `maxStoresBalanced`
   winkels (default 2).
5. **Besparing** = referentie − scenariototaal, geklemd op ≥ 0. De referentie is de
   duurste “hoofdwinkel”: alles daar, gaten bij de goedkoopste andere winkel.

Randgevallen die door tests zijn gedekt: lege lijst, < 2 winkels (alleen A), vastgezet
merk dat een winkel niet heeft (telt als ontbrekend), hoge drempel (C blijft bij één winkel).

## Volgende stappen (na fase 4)

- Prisma-schema + migraties uit `lib/types.ts` (zie fase 3, sectie 2).
- Ingestion-worker met de bestaande `boodschatje`-connectors achter een `PriceProvider`.
- `/lijsten`, `/aanbiedingen`, `/product/[slug]`, `/dashboard`, `/instellingen`, auth.
- Zie de MVP-roadmap in het architectuurdocument (M0–M4).
