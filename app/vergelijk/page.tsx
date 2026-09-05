// /vergelijk — de vergelijkingspagina.
//
// URL-state: ?lijst=<id> (je eigen lijst), ?winkels=ah,jumbo, ?scenario=cheapestSingle|balanced|maxSplit
// Prijzen komen uit de database (met collectedAt → versheids-indicator).

import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { freshnessLabel, getCompareCatalog } from "@/lib/catalog-db";
import { compareList, formatEuro } from "@/lib/compare";
import { db } from "@/lib/db";
import { getListWithItems, getUserId, toEngineItems } from "@/lib/lists";
import type { BrandMode, CompareResult, ListItem, Scenario, StoreId } from "@/lib/types";
import { ReceiptCopyButton } from "./receipt-copy";
import { StoreSelector } from "./store-selector";

export const dynamic = "force-dynamic";

const DEMO_LIST: ListItem[] = [
  { id: "1", productId: "melk", quantity: 2, brandMode: "any" },
  { id: "2", productId: "koffie", quantity: 1, brandMode: "any" },
  { id: "3", productId: "chips", quantity: 2, brandMode: "any" },
  { id: "4", productId: "wasmiddel", quantity: 1, brandMode: "any" },
  { id: "5", productId: "jus", quantity: 1, brandMode: "any" },
  { id: "6", productId: "roomboter", quantity: 1, brandMode: "any" },
  { id: "7", productId: "pindakaas", quantity: 1, brandMode: { brand: "Calvé" } },
  { id: "8", productId: "kipfilet", quantity: 1, brandMode: "any" },
];

const SCENARIOS = [
  { key: "cheapestSingle", tag: "Scenario A", title: "Goedkoopste winkel", blurb: "Alles bij één supermarkt." },
  { key: "balanced", tag: "Scenario C", title: "Beste balans", blurb: "Hooguit 2 winkels." },
  { key: "maxSplit", tag: "Scenario B", title: "Maximaal splitsen", blurb: "Elk product z'n goedkoopste winkel." },
] as const;
type ScenarioKey = (typeof SCENARIOS)[number]["key"];

const brandLabel = (m: BrandMode) =>
  m === "any" ? "maakt niet uit" : m === "own" ? "alleen huismerk" : m.brand;

export default async function VergelijkPage({
  searchParams,
}: {
  searchParams: Promise<{ winkels?: string; scenario?: string; lijst?: string }>;
}) {
  const sp = await searchParams;
  const { catalog, supermarkets, freshness } = await getCompareCatalog();
  const allStoreIds = supermarkets.map((s) => s.id);
  const storeName = (id: StoreId) => supermarkets.find((s) => s.id === id)?.name ?? id;
  const storeShort = (id: StoreId) => supermarkets.find((s) => s.id === id)?.short ?? id;

  const selected = sp.winkels?.split(",").filter((id) => allStoreIds.includes(id)) ?? allStoreIds;
  const storeIds = selected.length ? selected : allStoreIds;

  const userId = await getUserId();

  // lijst
  let listName: string | null = null;
  let items = DEMO_LIST;
  if (sp.lijst) {
    const list = userId ? await getListWithItems(userId, sp.lijst) : null;
    if (list) {
      listName = list.name;
      items = toEngineItems(list.items);
    }
  }

  const pref = userId
    ? await db.userPreference.findUnique({ where: { userId }, select: { minExtraStoreSavingCents: true } })
    : null;

  const result: CompareResult = compareList(items, catalog, supermarkets, {
    storeIds,
    maxStoresBalanced: 2,
    minExtraStoreSavingCents: pref?.minExtraStoreSavingCents,
  });
  const slugByItemId = new Map(items.map((it) => [it.id, it.productId]));

  const activeKey: ScenarioKey =
    (sp.scenario as ScenarioKey) && SCENARIOS.some((s) => s.key === sp.scenario)
      ? (sp.scenario as ScenarioKey)
      : (result.recommended as ScenarioKey) ?? "cheapestSingle";
  const active: Scenario | null = result[activeKey];

  // link-helper die de andere params behoudt
  const urlWith = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    if (sp.lijst) q.set("lijst", sp.lijst);
    if (storeIds.length && storeIds.length < allStoreIds.length) q.set("winkels", storeIds.join(","));
    q.set("scenario", activeKey);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) q.delete(k);
      else q.set(k, v);
    }
    return `/vergelijk?${q.toString()}`;
  };

  // versheid
  const overall = freshnessLabel(freshness.oldest);
  const staleStores = storeIds.filter((s) => freshnessLabel(freshness.byStore[s]).stale);

  // bon voor het actieve scenario
  const receiptLines: { store: StoreId; cents: number }[] = [];
  if (active) {
    const perStore = new Map<StoreId, number>();
    for (const row of result.rows) {
      const s = active.assignment[row.itemId];
      const cell = s ? row.perStore[s] : undefined;
      if (cell && !("missing" in cell)) perStore.set(s, (perStore.get(s) ?? 0) + cell.lineCents);
    }
    for (const [store, cents] of perStore) receiptLines.push({ store, cents });
    receiptLines.sort((a, b) => b.cents - a.cents);
  }
  const receiptText = active
    ? [
        `KORF — ${listName ?? "voorbeeldlijst"} (${items.length} regels)`,
        ...receiptLines.map((l) => `${storeName(l.store).padEnd(16)} ${formatEuro(l.cents)}`),
        `${"Totaal".padEnd(16)} ${formatEuro(active.totalCents)}`,
        `Bespaard t.o.v. ${result.referenceLabel}: ${formatEuro(active.savingCents)}`,
        `demodata — geen actuele prijzen`,
      ].join("\n")
    : "";

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-10">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">Vergelijking</p>
        <h1 className="mt-2 font-display text-3xl font-light text-ink">
          {listName ?? "Je lijst, elke supermarktprijs ernaast"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {listName && (
            <>
              <Link href={`/lijst/${sp.lijst}`} className="text-brass underline underline-offset-2">
                ← lijst bewerken
              </Link>
              {" · "}
            </>
          )}
          Demodata. Prijzen {overall.text}.
        </p>

        {staleStores.length > 0 && (
          <p className="mt-3 rounded-xl border border-brass bg-brass-wash px-4 py-2.5 text-sm text-text">
            ⚠ Prijzen van {staleStores.map(storeName).join(", ")} zijn ouder dan 24 uur — check ze in de winkel.
          </p>
        )}

        <div className="mt-6">
          <StoreSelector all={supermarkets} selected={storeIds} />
        </div>

        {/* scenario-switcher */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {SCENARIOS.map(({ key, tag, title, blurb }) => {
            const data = result[key];
            const isActive = key === activeKey;
            const isRecommended = result.recommended === key;
            return (
              <Link
                key={key}
                href={urlWith({ scenario: key })}
                scroll={false}
                className={`rounded-2xl border p-4 transition-colors ${
                  isActive
                    ? "border-ink bg-ink text-ground"
                    : isRecommended
                      ? "border-brass bg-brass-wash"
                      : "border-line bg-raised hover:border-brass-line"
                }`}
              >
                <p
                  className={`font-mono text-[0.6rem] uppercase tracking-widest ${
                    isActive ? "text-ground/70" : isRecommended ? "text-brass" : "text-muted"
                  }`}
                >
                  {isActive ? "Gekozen" : isRecommended ? "Aanbevolen" : tag}
                </p>
                <p className={`mt-1 font-display text-lg ${isActive ? "text-ground" : "text-ink"}`}>{title}</p>
                {data ? (
                  <>
                    <p className={`mt-1 font-mono text-xl font-medium tabular-nums ${isActive ? "text-ground" : "text-ink"}`}>
                      {formatEuro(data.totalCents)}
                    </p>
                    <p className={`font-mono text-xs ${isActive ? "text-ground/80" : "text-sage"}`}>
                      {data.savingCents > 0 ? `bespaart ${formatEuro(data.savingCents)}` : "referentie"}
                    </p>
                    <p className={`mt-1 text-xs ${isActive ? "text-ground/70" : "text-muted"}`}>
                      {data.storeIds.map(storeShort).join(" + ")}
                    </p>
                  </>
                ) : (
                  <p className={`mt-2 text-xs ${isActive ? "text-ground/70" : "text-muted"}`}>
                    {storeIds.length < 2 ? "Kies ≥ 2 winkels" : blurb}
                  </p>
                )}
              </Link>
            );
          })}
        </div>

        {/* gekozen scenario: besparing + bon */}
        {active && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-raised p-5">
              <p className="font-mono text-[0.62rem] uppercase tracking-wider text-muted">Zo is de besparing opgebouwd</p>
              <dl className="mt-3 space-y-1.5 font-mono text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Referentie ({result.referenceLabel})</dt>
                  <dd className="tabular-nums">{formatEuro(result.referenceTotalCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">− {SCENARIOS.find((s) => s.key === activeKey)!.title}</dt>
                  <dd className="tabular-nums">{formatEuro(active.totalCents)}</dd>
                </div>
                <div className="flex justify-between border-t border-dashed border-line pt-1.5 font-bold text-sage">
                  <dt>= Je bespaart</dt>
                  <dd className="tabular-nums">{formatEuro(active.savingCents)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-line bg-raised p-5 font-mono text-sm">
              <div className="flex items-baseline justify-between text-[0.62rem] uppercase tracking-wider text-muted">
                <span>Kassabon</span>
                <ReceiptCopyButton text={receiptText} />
              </div>
              <div className="mt-3 space-y-1">
                {receiptLines.map((l) => (
                  <div key={l.store} className="flex justify-between">
                    <span>{storeName(l.store)}</span>
                    <span className="tabular-nums">{formatEuro(l.cents)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-dashed border-line pt-1 font-bold text-ink">
                  <span>Totaal</span>
                  <span className="tabular-nums">{formatEuro(active.totalCents)}</span>
                </div>
              </div>
              <p className="mt-3 text-[0.62rem] leading-relaxed text-muted">
                Bonuskaart- en volumekortingen niet verrekend · landelijk / online.
              </p>
            </div>
          </div>
        )}

        {/* per winkel */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {storeIds.map((id) => {
            const t = result.perStoreTotals[id];
            return (
              <div key={id} className="rounded-xl border border-line bg-raised p-4">
                <p className="font-mono text-xs uppercase tracking-wider text-muted">{storeName(id)}</p>
                {t.missing === 0 ? (
                  <p className="mt-1 font-mono text-lg text-ink tabular-nums">{formatEuro(t.totalCents)}</p>
                ) : (
                  <p className="mt-1 text-sm text-muted">
                    mist {t.missing} van {result.rows.length}
                  </p>
                )}
                <p className="mt-1 font-mono text-[0.62rem] text-muted">
                  {freshnessLabel(freshness.byStore[id]).text}
                </p>
              </div>
            );
          })}
        </div>

        {/* product voor product */}
        <h2 className="mt-10 font-display text-xl font-light text-ink">Product voor product</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-3 text-left font-mono text-[0.62rem] uppercase tracking-wider text-muted">Product</th>
                {storeIds.map((id) => (
                  <th key={id} className="p-3 text-right font-mono text-[0.62rem] uppercase tracking-wider text-muted">
                    {storeShort(id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => {
                const chosen = active?.assignment[row.itemId];
                return (
                  <tr key={row.itemId} className="border-t border-line/60">
                    <td className="p-3">
                      <Link href={`/product/${slugByItemId.get(row.itemId) ?? ""}`} className="font-semibold text-ink hover:underline">
                        {row.label}
                      </Link>{" "}
                      ×{row.quantity}
                      <span className="block font-mono text-[0.64rem] text-muted">merk: {brandLabel(row.brandMode)}</span>
                    </td>
                    {storeIds.map((id) => {
                      const cell = row.perStore[id];
                      if ("missing" in cell) {
                        return (
                          <td key={id} className="p-3 text-right font-mono text-muted">
                            {row.brandMode === "any" ? "—" : "niet in dit merk"}
                          </td>
                        );
                      }
                      const isChosen = chosen === id;
                      const isCheapest = row.cheapestStoreId === id;
                      return (
                        <td
                          key={id}
                          className={`p-3 text-right font-mono tabular-nums ${
                            isChosen ? "bg-sage-wash font-bold text-sage" : isCheapest ? "text-sage" : "text-text"
                          }`}
                        >
                          {formatEuro(cell.effectiveCents)}
                          {cell.promo && (
                            <span className="ml-1 rounded-full border border-brass px-1 text-[0.55rem] uppercase text-brass">
                              {cell.promo.label}
                            </span>
                          )}
                          {row.brandMode === "any" && (
                            <span className="block text-[0.6rem] text-muted">{cell.brand}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-line">
                <td className="p-3 font-mono font-bold text-ink">Totaal</td>
                {storeIds.map((id) => {
                  const t = result.perStoreTotals[id];
                  return (
                    <td key={id} className="p-3 text-right font-mono font-bold text-ink">
                      {t.missing ? (
                        <span className="text-xs font-normal text-muted">mist {t.missing}</span>
                      ) : (
                        formatEuro(t.totalCents)
                      )}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 font-mono text-[0.62rem] text-muted">
          Salie-vlak = de winkel waar je dit product haalt in “{SCENARIOS.find((s) => s.key === activeKey)!.title}”.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {listName && (
            <Link href={`/lijst/${sp.lijst}`} className="rounded-xl border border-line px-4 py-2.5 text-sm text-ink">
              ← Terug naar je lijst
            </Link>
          )}
          {listName && active ? (
            <Link
              href={`/lijst/${sp.lijst}/doen?winkels=${storeIds.join(",")}&scenario=${activeKey}`}
              className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-ground"
            >
              Boodschappen doen met dit scenario
            </Link>
          ) : (
            <button
              disabled
              className="cursor-not-allowed rounded-xl border border-line px-4 py-2.5 text-sm text-muted"
              title={listName ? "Kies eerst een scenario" : "Alleen bij je eigen lijst"}
            >
              Boodschappen doen met dit scenario
            </button>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
