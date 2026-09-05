import type { Metadata } from "next";
import Link from "next/link";
import { ProductTile } from "@/components/product-tile";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { addToActiveList } from "@/lib/list-actions";
import { getOfferFilters, getOffers } from "@/lib/offers";
import { formatEuro } from "@/lib/compare";
import { getUserId } from "@/lib/lists";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aanbiedingen — Korf",
  description: "Actuele aanbiedingen bij Albert Heijn, Jumbo en Lidl, filterbaar per winkel en categorie. Demodata.",
};

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(new Date(iso));

export default async function AanbiedingenPage({
  searchParams,
}: {
  searchParams: Promise<{ winkel?: string; categorie?: string }>;
}) {
  const sp = await searchParams;
  const [offers, filters, userId] = await Promise.all([
    getOffers({ store: sp.winkel, category: sp.categorie }),
    getOfferFilters(),
    getUserId(),
  ]);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${active ? "border-brass bg-brass-wash text-ink" : "border-line text-muted hover:text-ink"}`;
  const withParam = (k: "winkel" | "categorie", v?: string) => {
    const q = new URLSearchParams();
    if (sp.winkel && k !== "winkel") q.set("winkel", sp.winkel);
    if (sp.categorie && k !== "categorie") q.set("categorie", sp.categorie);
    if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/aanbiedingen?${s}` : "/aanbiedingen";
  };

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-5xl px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">Aanbiedingen</p>
        <h1 className="mt-2 font-display text-3xl font-light text-ink">Wat er nu in de actie is</h1>
        <p className="mt-2 text-sm text-muted">Demodata — geen actuele prijzen. {offers.length} aanbiedingen.</p>

        {/* filters */}
        <div className="mt-6 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[0.62rem] uppercase text-muted">Winkel</span>
            <Link href={withParam("winkel", undefined)} className={chip(!sp.winkel)}>alle</Link>
            {filters.stores.map((s) => (
              <Link key={s.slug} href={withParam("winkel", s.slug)} className={chip(sp.winkel === s.slug)}>
                {s.name}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[0.62rem] uppercase text-muted">Categorie</span>
            <Link href={withParam("categorie", undefined)} className={chip(!sp.categorie)}>alle</Link>
            {filters.categories.map((c) => (
              <Link key={c.slug} href={withParam("categorie", c.slug)} className={chip(sp.categorie === c.slug)}>
                {c.name}
              </Link>
            ))}
          </div>
        </div>

        {offers.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-line bg-raised p-8 text-center text-sm text-muted">
            Geen aanbiedingen voor deze combinatie.
          </p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((o, i) => (
              <li key={`${o.canonicalSlug}-${o.storeSlug}-${i}`} className="flex flex-col rounded-2xl border border-line bg-raised p-4">
                <div className="flex items-start gap-3">
                  <ProductTile
                    product={{ id: o.canonicalSlug, name: o.productName, category: o.category }}
                    brand={o.brand}
                    size={46}
                  />
                  <div className="min-w-0 flex-1">
                    <Link href={`/product/${o.canonicalSlug}`} className="font-semibold text-ink hover:underline">
                      {o.productName}
                    </Link>
                    <p className="font-mono text-[0.68rem] text-muted">{o.brand} · {o.storeName}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-baseline gap-2 font-mono">
                  {o.promoCents != null ? (
                    <>
                      <span className="text-lg font-medium text-sage tabular-nums">{formatEuro(o.promoCents)}</span>
                      <span className="text-xs text-muted line-through">{formatEuro(o.normalCents)}</span>
                    </>
                  ) : (
                    <span className="text-sm text-ink">{formatEuro(o.normalCents)}</span>
                  )}
                  {o.pctOff != null && o.pctOff > 0 && (
                    <span className="rounded-full bg-sage-wash px-1.5 text-[0.6rem] text-sage">−{o.pctOff}%</span>
                  )}
                </div>
                <p className="mt-1 font-mono text-[0.62rem] text-muted">
                  {o.label} · t/m {fmtDate(o.endsAt)}
                </p>

                <div className="mt-3 flex gap-2">
                  {userId ? (
                    <form action={addToActiveList.bind(null, o.canonicalSlug)}>
                      <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink hover:bg-ground">
                        + naar lijst
                      </button>
                    </form>
                  ) : (
                    <Link
                      href={`/inloggen?callbackUrl=/aanbiedingen`}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted"
                    >
                      log in om toe te voegen
                    </Link>
                  )}
                  <Link
                    href={`/product/${o.canonicalSlug}`}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink hover:bg-ground"
                  >
                    Details
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
