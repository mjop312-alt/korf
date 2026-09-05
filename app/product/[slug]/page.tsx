import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PriceAlertControl } from "@/components/price-alert-control";
import { PriceHistoryChart } from "@/components/price-history-chart";
import { ProductTile } from "@/components/product-tile";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { freshnessLabel } from "@/lib/catalog-db";
import { formatEuro } from "@/lib/compare";
import { getMyAlert } from "@/lib/alerts";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import { addToActiveList } from "@/lib/list-actions";
import { getUserId } from "@/lib/lists";
import { getPriceHistory, getProductDetail } from "@/lib/offers";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductDetail(slug);
  return p
    ? { title: `${p.name} — prijzen vergeleken — Korf`, description: `Prijzen, prijsverloop en alternatieven voor ${p.name}. Demodata.` }
    : { title: "Product niet gevonden — Korf" };
}

const unitLabel: Record<string, string> = { kg: "kg", litre: "l", piece: "stuk", pack: "verpakking" };

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, history, userId] = await Promise.all([
    getProductDetail(slug),
    getPriceHistory(slug),
    getUserId(),
  ]);
  if (!product) notFound();

  const [alert, fav] = await Promise.all([getMyAlert(slug), isFavorite(slug)]);
  const lowest = product.lowest;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    category: product.category,
    offers: product.offers.map((o) => ({
      "@type": "Offer",
      price: (o.effectiveCents / 100).toFixed(2),
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: o.storeName },
    })),
  };

  return (
    <div className="min-h-screen bg-ground text-text">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-4xl px-6 py-10">
        <Link href={`/aanbiedingen?categorie=${product.categorySlug}`} className="font-mono text-xs text-muted hover:text-ink">
          ← {product.category}
        </Link>

        {/* header */}
        <div className="mt-3 flex flex-wrap items-start gap-5">
          <ProductTile product={{ id: product.slug, name: product.name, category: product.category }} brand={lowest?.brand ?? null} size={88} />
          <div>
            <h1 className="font-display text-3xl font-light text-ink">{product.name}</h1>
            {lowest && (
              <p className="mt-2 font-mono text-sm text-muted">
                Nu vanaf{" "}
                <span className="text-lg font-medium text-sage">{formatEuro(lowest.effectiveCents)}</span>{" "}
                bij {lowest.storeName}
                {lowest.unitPriceCents != null && (
                  <> · {formatEuro(lowest.unitPriceCents)}/{unitLabel[product.baseUnit] ?? product.baseUnit}</>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {userId ? (
            <>
              <form action={addToActiveList.bind(null, product.slug)}>
                <button className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-ground">Voeg toe aan je lijst</button>
              </form>
              <form action={toggleFavorite.bind(null, product.slug)}>
                <button
                  className={`rounded-xl border px-4 py-2.5 text-sm ${fav ? "border-brass bg-brass-wash text-brass" : "border-line text-muted hover:text-ink"}`}
                  aria-pressed={fav}
                >
                  {fav ? "♥ Favoriet" : "♡ Bewaar als favoriet"}
                </button>
              </form>
            </>
          ) : (
            <Link href={`/inloggen?callbackUrl=/product/${slug}`} className="rounded-xl border border-line px-5 py-2.5 text-sm text-ink">
              Log in om toe te voegen
            </Link>
          )}
        </div>

        {/* prijzen per winkel */}
        <h2 className="mt-10 font-display text-xl font-light text-ink">Prijs per winkel</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-line">
          {product.offers.map((o, i) => {
            const fresh = freshnessLabel(o.collectedAt);
            return (
              <div key={o.storeSlug + o.brand + i} className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 px-4 py-3 first:border-t-0">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.storeColor }} />
                  <span className="font-medium text-ink">{o.storeName}</span>
                  <span className="font-mono text-xs text-muted">{o.brand}</span>
                  {o.isPromo && o.promoLabel && (
                    <span className="rounded-full border border-brass px-1.5 text-[0.55rem] uppercase text-brass">{o.promoLabel}</span>
                  )}
                </div>
                <div className="text-right font-mono">
                  <span className={`text-sm ${i === 0 ? "font-bold text-sage" : "text-ink"}`}>{formatEuro(o.effectiveCents)}</span>
                  {o.isPromo && o.priceCents !== o.effectiveCents && (
                    <span className="ml-1.5 text-xs text-muted line-through">{formatEuro(o.priceCents)}</span>
                  )}
                  <span className={`block text-[0.6rem] ${fresh.stale ? "text-clay" : "text-muted"}`}>{fresh.text}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* prijsverloop */}
        <h2 className="mt-10 font-display text-xl font-light text-ink">Prijsverloop</h2>
        <p className="mt-1 text-sm text-muted">Laagste prijs per week per supermarkt, laatste 3 maanden. Demodata.</p>
        <div className="mt-4 rounded-2xl border border-line bg-raised p-4 sm:p-6">
          <PriceHistoryChart
            series={history.map((h) => ({ storeSlug: h.storeSlug, storeName: h.storeName, color: h.color, points: h.points }))}
          />
        </div>

        {/* prijsalert */}
        <h2 className="mt-10 font-display text-xl font-light text-ink">Prijsalert</h2>
        <div className="mt-3">
          <PriceAlertControl
            slug={product.slug}
            loggedIn={!!userId}
            currentThresholdCents={alert?.thresholdCents ?? null}
            suggestCents={Math.round((lowest?.effectiveCents ?? 200) * 0.9)}
          />
        </div>

        {/* alternatieven */}
        {product.alternatives.length > 0 && (
          <>
            <h2 className="mt-10 font-display text-xl font-light text-ink">In dezelfde categorie</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {product.alternatives.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/product/${a.slug}`}
                    className="flex items-center justify-between rounded-xl border border-line bg-raised px-4 py-2.5 text-sm hover:border-brass-line"
                  >
                    <span className="text-ink">{a.name}</span>
                    <span className="font-mono text-xs text-sage">
                      {a.lowestCents != null ? `vanaf ${formatEuro(a.lowestCents)}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
