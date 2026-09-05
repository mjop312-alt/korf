// /lijst/[id]/doen — afvink-modus: de gekozen vergelijk-scenario als boodschappenlijst
// per winkel, met een voortgangsbalk. Bereikbaar via de knop op /vergelijk.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ShoppingChecklist } from "@/components/shopping-checklist";
import { getCompareCatalog } from "@/lib/catalog-db";
import { compareList, formatEuro } from "@/lib/compare";
import { getListWithItems, getUserId, toEngineItems } from "@/lib/lists";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Boodschappen doen — Korf" };

const SCENARIO_KEYS = ["cheapestSingle", "balanced", "maxSplit"] as const;
type ScenarioKey = (typeof SCENARIO_KEYS)[number];

export default async function DoenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ winkels?: string; scenario?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const userId = await getUserId();
  if (!userId) redirect(`/inloggen?callbackUrl=/lijst/${id}/doen`);

  const list = await getListWithItems(userId, id);
  if (!list) notFound();

  const { catalog, supermarkets } = await getCompareCatalog();
  const allStoreIds = supermarkets.map((s) => s.id);
  const storeIds = sp.winkels?.split(",").filter((s) => allStoreIds.includes(s)) ?? allStoreIds;

  const items = toEngineItems(list.items);
  const result = compareList(items, catalog, supermarkets, { storeIds, maxStoresBalanced: 2 });

  const requested = SCENARIO_KEYS.includes(sp.scenario as ScenarioKey) ? (sp.scenario as ScenarioKey) : null;
  const scenario = (requested && result[requested]) || result.balanced || result.cheapestSingle || result.maxSplit;

  if (!scenario || items.length === 0) redirect(`/lijst/${id}`);

  const checkedById = new Map(list.items.map((i) => [i.id, i.checked]));
  const storeName = (sid: string) => supermarkets.find((s) => s.id === sid)?.name ?? sid;

  const groups = scenario.storeIds.map((storeId) => {
    const store = supermarkets.find((s) => s.id === storeId)!;
    const rows = result.rows.filter((r) => scenario!.assignment[r.itemId] === storeId);
    return {
      storeId,
      storeName: store.name,
      storeColor: store.brandColor,
      items: rows.map((r) => {
        const cell = r.perStore[storeId];
        return {
          id: r.itemId,
          label: r.label,
          quantity: r.quantity,
          brandMode: r.brandMode,
          priceCents: cell && !("missing" in cell) ? cell.lineCents : null,
          checked: checkedById.get(r.itemId) ?? false,
        };
      }),
    };
  });

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href={`/vergelijk?lijst=${id}&winkels=${storeIds.join(",")}`}
          className="font-mono text-xs text-muted hover:text-ink"
        >
          ← terug naar de vergelijking
        </Link>
        <h1 className="mt-2 font-display text-3xl font-light text-ink">Boodschappen doen</h1>
        <p className="mt-1 text-sm text-muted">
          {list.name} · {scenario.storeIds.length > 1 ? `${scenario.storeIds.length} winkels` : storeName(scenario.storeIds[0])} · totaal {formatEuro(scenario.totalCents)}
        </p>

        <ShoppingChecklist listId={id} groups={groups} />
      </main>
      <SiteFooter />
    </div>
  );
}
