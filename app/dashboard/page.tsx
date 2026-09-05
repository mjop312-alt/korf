import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getCompareCatalog } from "@/lib/catalog-db";
import { compareList, formatEuro } from "@/lib/compare";
import { db } from "@/lib/db";
import { getFavorites } from "@/lib/favorites";
import { getMyAlerts } from "@/lib/alerts";
import { addToActiveList } from "@/lib/list-actions";
import { getLists, getListWithItems, getOrCreateActiveList, getUserId, toEngineItems } from "@/lib/lists";
import { defaultStoreIds } from "@/lib/preferences";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard — Korf" };

const fmtDate = (d: Date) => new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(d);

export default async function DashboardPage() {
  const userId = await getUserId();
  if (!userId) redirect("/inloggen?callbackUrl=/dashboard");

  const [user, active, lists, favorites, alerts, { catalog, supermarkets }] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    getOrCreateActiveList(userId),
    getLists(userId),
    getFavorites(),
    getMyAlerts(),
    getCompareCatalog(),
  ]);

  const withItems = await getListWithItems(userId, active.id);
  const items = withItems ? toEngineItems(withItems.items) : [];
  const storeIds = await defaultStoreIds(userId, supermarkets.map((s) => s.id));
  const result = compareList(items, catalog, supermarkets, { storeIds, maxStoresBalanced: 2 });
  const best = result.balanced ?? result.cheapestSingle;
  const cheapestStore = result.complete[0]
    ? supermarkets.find((s) => s.id === result.complete[0].storeId)?.name
    : null;
  const offerCount = result.rows.filter((r) =>
    storeIds.some((s) => {
      const c = r.perStore[s];
      return c && !("missing" in c) && c.promo;
    }),
  ).length;

  const stat = (label: string, value: string, sub?: string) => (
    <div className="rounded-2xl border border-line bg-raised p-4">
      <p className="font-mono text-[0.6rem] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl font-medium text-ink tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-3xl font-light text-ink">
          Hoi{user?.name ? ` ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Actieve lijst: <Link href={`/lijst/${active.id}`} className="text-brass underline underline-offset-2">{active.name}</Link>
        </p>

        {/* statistiekrij */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stat("Geschat totaal", best ? formatEuro(best.totalCents) : "—", `${items.length} producten`)}
          {stat("Mogelijke besparing", best && best.savingCents > 0 ? formatEuro(best.savingCents) : "—", `t.o.v. ${result.referenceLabel || "duurste"}`)}
          {stat("Goedkoopste winkel", cheapestStore ?? "—")}
          {stat("Aanbiedingen op je lijst", String(offerCount))}
        </div>

        {best && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/vergelijk?lijst=${active.id}`} className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-ground">
              Vergelijk prijzen
            </Link>
            <Link href="/aanbiedingen" className="rounded-xl border border-line px-4 py-2 text-sm text-ink">
              Bekijk aanbiedingen
            </Link>
            <Link href="/instellingen" className="rounded-xl border border-line px-4 py-2 text-sm text-ink">
              Instellingen
            </Link>
          </div>
        )}

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {/* recente lijsten */}
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-light text-ink">Recente lijsten</h2>
              <Link href="/lijsten" className="font-mono text-xs text-brass hover:underline">alle →</Link>
            </div>
            <ul className="mt-3 space-y-2">
              {lists.slice(0, 4).map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/lijst/${l.id}`}
                    className="flex items-center justify-between rounded-xl border border-line bg-raised px-4 py-2.5 text-sm hover:border-brass-line"
                  >
                    <span className="text-ink">
                      {l.name} {l.isActive && <span className="font-mono text-[0.55rem] uppercase text-brass">· actief</span>}
                    </span>
                    <span className="font-mono text-xs text-muted">{l._count.items} · {fmtDate(l.updatedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* favorieten */}
          <section>
            <h2 className="font-display text-xl font-light text-ink">Favoriete producten</h2>
            {favorites.length === 0 ? (
              <p className="mt-3 rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">
                Nog geen favorieten. Markeer een product met ♥ op de productpagina.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {favorites.slice(0, 5).map((f) => (
                  <li key={f.slug} className="flex items-center justify-between rounded-xl border border-line bg-raised px-4 py-2 text-sm">
                    <Link href={`/product/${f.slug}`} className="text-ink hover:underline">{f.name}</Link>
                    <form action={addToActiveList.bind(null, f.slug)}>
                      <button className="font-mono text-xs text-brass hover:underline">+ lijst</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* prijsalerts */}
        {alerts.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-light text-ink">Je prijsalerts</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {alerts.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/product/${a.canonicalProduct.slug}`}
                    className="rounded-full border border-line px-3 py-1 text-xs text-ink hover:bg-raised"
                  >
                    {a.canonicalProduct.name} &lt; {formatEuro(a.thresholdCents)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
