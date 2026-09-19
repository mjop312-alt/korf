# Korf — werkende kern (fase 4)

Premium prijs- en aanbiedingenvergelijker voor Nederlandse boodschappen.
Dit is de **kern uit fase 4**: de geverifieerde scenario-engine, mockdata, een API-route
en twee werkende schermen. Het merkconcept, de blauwdruk en de architectuur staan in de
bijbehorende documenten (fase 1–3).

> **Echte data.** De app draait op de volledige online catalogus van Albert Heijn, Jumbo en Lidl
> (crawlers + worker, zie "Volledige catalogus + worker"). Postgres (Neon) — elke prijs met een `collected_at`.
> De mockdata bestaat alleen nog voor de tests en de voorbeeldbesparing op de homepage.

## Draaien

```bash
npm install             # draait ook 'prisma generate'
cp .env.example .env    # vul DATABASE_URL in met je eigen Postgres-connectiestring (bv. Neon)
npm run db:push         # zet het schema op die database
npm run db:seed         # vult 'm met de mockdata + een demo-account
npm run dev             # http://localhost:3000
```

Node 20+ (getest op Node 24). Werkt ook lokaal zonder externe dienst: zet `DATABASE_URL` op
`file:./dev.db` en `provider` in `prisma/schema.prisma` terug op `"sqlite"` — het schema is
bewust portabel geschreven, dat werkte hiervoor prima.

**Let op met `npm run db:reset`**: dat draait `--force-reset` tegen wat er ook in
`DATABASE_URL` staat. Op een gedeelde Neon-database is dat net zo destructief als op een
lokaal bestand — geen bevestigingsvraag.

**Demo-login:** `demo@korf.nl` / `demo1234`

### Handige scripts

| Script | Wat |
| --- | --- |
| `npm test` / `npm run typecheck` | Vitest (21) / `tsc --noEmit` |
| `npm run db:reset` | schema opnieuw + opnieuw seeden (wist alles) |
| `npm run db:studio` | Prisma Studio — de database bekijken |
| `npm run crawl` / `npm run worker` | eenmalig / doorlopend de winkelcatalogi ophalen (zie hieronder) |
| `npm run regroup` | alle producten opnieuw in productgroepen indelen + EAN-samenvoeging (`-- --stats` = alleen cijfers) |
| `npm run enrich-ean` | AH-producten van een EAN voorzien (hervatbaar; nodig om AH en Jumbo op barcode te matchen) |
| `npm run smoke` | rooktest van een draaiende app: alle pagina's en API's ophalen en op 200 + inhoud controleren |
| `npm run purge-mock` | eenmalig: oude mockrijen uit de database halen |
| `npm run check-alerts` | alert-trigger-job: prijsalerts tegen actuele prijzen, mailt de treffers (cron: elk uur) |
| `npm run weekly-summary` | wekelijkse besparingssamenvatting per e-mail (cron: 1×/week) |

## Fundering (M0)

| Pad | Wat |
| --- | --- |
| `prisma/schema.prisma` | Volledig datamodel. Draait op **Postgres (Neon)**, portabel geschreven (werkte hiervoor ook op lokale SQLite zonder wijzigingen aan het schema zelf). |
| `prisma/seed.ts` | Winkels, categorieën en een demo-account met een lijst van echte producten (wist alleen gebruikersdata; catalogus komt uit de crawler). |
| `lib/db.ts` | Prisma-client singleton. |
| `auth.ts` / `auth.config.ts` / `middleware.ts` | Auth.js v5 — e-mail/wachtwoord-login, JWT-sessies, `/dashboard` · `/lijsten` · `/instellingen` afgeschermd. |
| `app/inloggen` · `app/registreren` · `app/api/auth/*` | Login- en registratieschermen + endpoints. |

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

## Kleine functionele gaten gedicht (na Delen & afvinken)

| Pad | Wat |
| --- | --- |
| `prisma/schema.prisma` (`ShoppingList.storeIds`) + `lib/list-actions.ts` (`setListStores`) | **Winkelselectie per lijst** — elke lijst onthoudt nu zijn eigen winkelselectie (was een algemene voorkeur die bij elke lijst opnieuw gold). Valt terug op de algemene voorkeur als een lijst nog niets heeft opgeslagen. |
| `lib/types.ts` (`BrandMode`), `lib/compare.ts`, `lib/catalog.ts` | **"Altijd A-merk"** is nu een echte merkkeuze (`a_brand`) naast "maakt niet uit" / vastgezet merk / "alleen huismerk" — kiest de goedkoopste niet-huismerk-variant, telt als ontbrekend als een winkel alleen een huismerk voert. De instelling "Altijd A-merk" onder Voorkeuren zet 'm nu ook echt als default voor nieuwe lijstregels. |
| `prisma/schema.prisma` (`SavingsRecord`) + `lib/savings.ts` | **Besparingsgeschiedenis** — een afgeronde boodschappentrip ("boodschappen doen": alles afvinken én "afgevinkte producten weghalen") legt een snapshot vast (bedrag, besparing, winkel(s)). Dashboard toont nu een balkjesgrafiek per maand + een lifetime-totaal, naast de bestaande "potentiële besparing op je huidige lijst". |
| `scripts/check-alerts.ts` | **Alert-trigger-job** — vergelijkt elke prijsalert met de actuele laagste prijs, mailt de treffers (respecteert `notify.priceAlerts`), zet `lastTriggeredAt` (niet vaker dan 1×/24u per alert). Cron: elk uur. |
| `scripts/weekly-summary.ts` | **Wekelijkse besparingssamenvatting** — mailt elke gebruiker die afgelopen 7 dagen ≥ 1 boodschappentrip afrondde (respecteert `notify.weeklySummary`): bespaard deze week / deze maand / sinds het begin. Cron: 1×/week. Geen trip = geen mail. |
| `lib/email.ts` + `lib/email-templates.ts` | E-mailverzending via de **Resend** REST-API (geen SDK). **No-op zonder `RESEND_API_KEY`** — de scripts loggen dan alleen wat ze zouden sturen (dry-run), net als de Sentry-setup. Aanzetten: account op resend.com → API-key + `EMAIL_FROM` in `.env`. |

## Volledige catalogus + worker (live prijzen en acties)

Korf haalt het **hele assortiment** van de supermarkten binnen (alle merken en huismerken, prijzen, acties) en houdt dat bij met een worker. Dit heeft de oude 65-producten-mockcatalogus vervangen (`npm run purge-mock` haalt de restanten uit de database).

| Pad | Wat |
| --- | --- |
| `lib/crawl/ah.ts` | **Albert Heijn** — per hoofdcategorie (`taxonomyId`), 1.000 producten per verzoek. AH weigert offset ≥ 3.000 (HTTP 400): categorieën boven de 3.000 worden automatisch in hun subcategorieën opgedeeld. Alleen `NATIONAL`-bonus telt als aanbieding; de online "volumevoordeel"-kortingen (`AHONLINE`) niet. Echte begin-/einddatums. |
| `lib/crawl/jumbo.ts` | **Jumbo** — GraphQL per hoofdcategorie, met EAN, categoriepad en echte actie-data. Een falende pagina wordt 3× herhaald en anders overgeslagen (niet de hele categorie). |
| `lib/crawl/lidl.ts` | **Lidl** — zoeken op `*` en food filteren. **Lidl.nl toont online maar ~200 food-producten** (van 9.361 items is de rest non-food): het volledige winkelschap staat niet online, dus dat kan niet uit deze bron. Lidl geeft geen merk/EAN/categorie mee; een titel in HOOFDLETTERS wordt als merk gelezen, anders geldt het als huismerk. |
| `lib/crawl/aldi.ts` | **Aldi** — de categoriepagina's van aldi.nl bevatten de complete Algolia-lijst als server-data (`__NEXT_DATA__`); we lezen alle ~170 tweede-niveaupagina's en ontdubbelen (~2.100 producten). Geen EAN. Eigen merken (Milsani, Choceur…) krijgen een titel zonder merk zodat ze op inhoud matchen met huismerken elders. |
| `lib/crawl/plus.ts` | **PLUS** — plus.nl is een OutSystems-app; dezelfde data-actie die de productlijst in de browser vult werkt met een anonieme sessiecookie (`PageNumber`, 12 per pagina, ~17.000 producten). `moduleVersion`/`apiVersion` worden elke ronde uit hun eigen scripts gelezen. Geen EAN in de lijst. Een ronde duurt ~12 min. |
| `lib/crawl/store.ts` | Bulk-opslag (`INSERT … ON CONFLICT` via `unnest`, ~800 producten per batch). Prijsgeschiedenis **alleen bij een wijziging**; onveranderde prijzen krijgen enkel een nieuwe `collectedAt`. Verdwenen producten worden na een volledige ronde op "niet beschikbaar" gezet (alleen bij ≥ 70% van het vorige aantal). |
| `lib/crawl/run.ts` | Eén ronde voor één winkel + logboek in de tabel `CrawlRun` (hoe vers, hoeveel, gelukt?). |
| `scripts/crawl.ts` | `npm run crawl` · `-- --store=ah` · `-- --dry --limit=200` (niets opslaan). |
| `scripts/worker.ts` | `npm run worker` — houdt alles vers, per winkel op een eigen ritme, met terugval bij fouten. `-- --once` voor cron/tests. |

### Productgroepen en zoeken

- **Groep = zelfde soort product in dezelfde hoeveelheid**, over alle winkels en alle merken/huismerken (`lib/crawl/group.ts`): sleutel = gesorteerde kernwoorden van de titel (zonder merk voor A-merken, zonder verpakking en stopwoorden) + hoeveelheid (`kg0.5`, `l1`, `st12`, multipack `x3`). Groepen zijn de "canonieke producten" waar lijsten, alerts en de vergelijker naar verwijzen.
- **EAN-samenvoeging** (`mergeByEan`, na elke volledige crawl en `regroup`): producten met dezelfde barcode horen in dezelfde groep, ook als de winkels ze anders noemen. Jumbo levert een EAN mee, AH alleen via het detail-endpoint (`npm run enrich-ean`, ~40 min voor alle producten); Lidl heeft er geen.
- **Zoeken** (`lib/catalog-search.ts`, `/producten`, `/api/products/search`): woorden op `searchText` (accentvrij titel + merk), een hoeveelheid in de zoekterm ("1 l") filtert op verpakking, filters op winkel/categorie/merk/A-merk↔huismerk/actie. Prijs = actieprijs als de actie loopt, anders schapprijs.
- **Eerlijke status** (`/betrouwbaarheid`): per winkel het aantal producten en de laatste *volledige* run, rechtstreeks uit `CrawlRun`.

**Ritme.** Geen enkele winkel heeft een "alleen aanbiedingen"-route (getest), dus elke verversing is een volledige scan van die winkel. Standaard: **AH elke 15 min, Jumbo elke 30, PLUS elke 30, Lidl en Aldi elke 60** (`CRAWL_INTERVAL_<WINKEL>_MIN` in `.env`). Een ronde kost AH ≈ 350 verzoeken (~2–3 min), Jumbo ≈ 1.000 (~4 min), Lidl ≈ 95 trage verzoeken (~4 min). Elke 5 minuten kan, maar is op onofficiële API's vragen om een blokkade — en prijzen veranderen hooguit een paar keer per dag (nieuwe acties meestal maandag).

**Lijstproducten elke 5 minuten.** Naast de volledige rondes ververst de worker de producten uit lijsten, favorieten en prijsalerts apart (`lib/crawl/hot.ts`, `npm run hot`): per productgroep en winkel de 3 goedkoopste varianten, één gerichte zoekopdracht per product. Getest: AH en Jumbo vinden ~97% terug (120–270 ms per product), Lidl maar ~50% en traag — daar geldt alleen de volledige ronde; Aldi (2 min) en PLUS hebben geen zoekroute en blijven op de volledige ronde (Aldi 15 min, PLUS 30). Interval: `CRAWL_HOT_INTERVAL_MIN` (standaard 5).

**Draaien.** De worker is een gewoon Node-proces: laat 'm draaien in een terminal, of start 'm bij het inloggen via Windows Taakplanner (`npm run worker`, werkmap = projectmap). Elke schrijfactie houdt de Neon-database wakker; een 24/7-worker past waarschijnlijk niet in het gratis Neon-plan.

## Legal & SEO

| Pad | Wat |
| --- | --- |
| `app/over`, `app/privacy`, `app/voorwaarden` | Templated pagina's (zelfde Q&A-stijl als `/betrouwbaarheid`), eerlijk gelabeld als **geen door een jurist opgestelde tekst** — Korf is een demoproject, geen geregistreerd bedrijf. Vervang de inhoud zodra dat wel zo is. Nu ook gelinkt vanuit de footer en het registratiescherm. |
| `app/sitemap.ts` / `app/robots.ts` | Next's ingebouwde `sitemap.xml`/`robots.txt`-generators. Sitemap bevat de statische marketingpagina's + alle 65 canonieke producten (`/product/[slug]`); robots sluit de ingelogde schermen uit. Zet `NEXT_PUBLIC_SITE_URL` in productie op het echte domein. |
| `app/product/[slug]/page.tsx` | JSON-LD (`schema.org/Product` + `Offer` per winkel) toegevoegd voor rijke zoekresultaten. |

## Rate-limiting & error-monitoring

| Pad | Wat |
| --- | --- |
| `lib/rate-limit.ts` | In-memory rate-limiter (geen Redis nodig — prima voor één instantie). Toegepast op `/api/auth/register` (5/uur per ip), inloggen (10/15 min per e-mailadres, in `auth.ts`) en `/api/compare` (60/min per ip). Geeft `429` + `Retry-After` terug. |
| `instrumentation.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts` / `instrumentation-client.ts` | **Sentry**-integratie (`@sentry/nextjs`), maar **uitgeschakeld zolang `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` leeg zijn** — geen account nodig voor lokale dev. Maak een gratis project op sentry.io en vul de DSN's in `.env` in om crashes daar te zien. `app/global-error.tsx` vangt fouten die de root layout zelf breken. |

## Toegankelijkheid & performance

Een gerichte pas, geen theoretische lijst — elke fix hieronder loste een concreet, gemeten probleem op:

| Probleem | Fix |
| --- | --- |
| `--color-brass` op licht (`#8a6a3a`) haalde 4.44:1 contrast tegen `--color-ground` — net onder de WCAG AA-eis van 4.5:1 voor tekst (brass wordt overal als linkkleur gebruikt). | Iets donkerder gezet (`#84632f`, 4.90:1). Nauwelijks zichtbaar verschil, wel binnen de norm. |
| De lijstnaam-rename-input (`/lijst/[id]`) had `outline-none` zonder vervangende ring — het enige focus-signaal was een `border-line`-randje met 1.28:1 contrast (WCAG eist 3:1 voor UI-componenten). Onzichtbaar voor toetsenbordgebruikers. | Zelfde `focus-visible:ring-2 focus-visible:ring-brass`-patroon als elk ander invoerveld op de site. |
| Homepage sloeg een koptekst-niveau over (`h1` → `h3` in de vertrouwensrij, vóór de eerste `h2`). | De drie kaartjes zijn nu `h2` — geen sprong meer in de documentstructuur. |
| Geen "naar de inhoud"-link — toetsenbord-/schermlezergebruikers moeten op elke pagina eerst door de hele header-navigatie tabben. | Skip-link toegevoegd in `app/layout.tsx` (zichtbaar bij focus), elke pagina's `<main>` kreeg `id="main-content"` (19 bestanden). |
| `ShareListDialog`'s "Deel"-knop opent een paneel zonder dat een schermlezer weet dat het een uitklapbaar element is. | `aria-haspopup`/`aria-expanded` op de knop, `role="region"` + `aria-label` op het paneel. |
| Performance-doorloop: `force-dynamic` op 11 pagina's gecontroleerd — allemaal terecht (auth-gebonden of prijzen die vers moeten zijn; statisch maken zou persoonlijke data tussen gebruikers laten lekken). Client/server-componentsplitsing nagelopen — 13 client-components, allemaal aantoonbaar interactief. Geen losse `<img>`-tags die `next/image` omzeilen. | Geen wijziging nodig — bevestigd, niet aangenomen. |

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
