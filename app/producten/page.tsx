import type { Metadata } from "next";
import Link from "next/link";
import { ProductTile } from "@/components/product-tile";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listCategories, searchGroups, topBrands, type SearchOptions } from "@/lib/catalog-search";
import { formatEuro } from "@/lib/compare";
import { db } from "@/lib/db";
import { DIET_TAGS } from "@/lib/diet-filters";
import { addToActiveList } from "@/lib/list-actions";
import { getUserId } from "@/lib/lists";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Producten — Korf",
  description: "Zoek en vergelijk het hele assortiment van Albert Heijn, Jumbo en Lidl: alle merken en huismerken.",
};

type SP = { q?: string; winkel?: string; categorie?: string; merk?: string; soort?: string; actie?: string; pagina?: string; sorteer?: string; dieet?: string };

const STORES = [
  { slug: "ah", name: "Albert Heijn" },
  { slug: "jumbo", name: "Jumbo" },
  { slug: "lidl", name: "Lidl" },
  { slug: "aldi", name: "Aldi" },
  { slug: "plus", name: "PLUS" },
];

export default async function ProductenPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(parseInt(sp.pagina ?? "1", 10) || 1, 1);
  // meerdere winkels/dieetwensen tegelijk aanvinken: kommagescheiden in de URL ("winkel=ah,jumbo")
  const selectedStores = (sp.winkel ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const selectedDiets = (sp.dieet ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const opts: SearchOptions = {
    q: sp.q?.slice(0, 80),
    stores: selectedStores.length ? selectedStores : undefined,
    category: sp.categorie,
    brand: sp.merk,
    kind: sp.soort === "a" || sp.soort === "own" ? sp.soort : undefined,
    diet: selectedDiets.length ? selectedDiets : undefined,
    promo: sp.actie === "1",
    sort: sp.sorteer === "price" ? "price" : sp.sorteer === "stores" ? "stores" : "relevance",
    page,
    pageSize: 24,
  };
  const [res, cats, brands, userId] = await Promise.all([
    searchGroups(db, opts),
    listCategories(db),
    topBrands(db, opts, 10),
    getUserId(),
  ]);
  const pages = Math.max(Math.ceil(res.total / res.pageSize), 1);

  const href = (patch: Partial<Record<keyof SP, string | undefined>>) => {
    const q = new URLSearchParams();
    const merged: SP = { ...sp, pagina: undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/producten?${s}` : "/producten";
  };
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${active ? "border-brass bg-brass-wash text-ink" : "border-line text-muted hover:text-ink"}`;
  // klik op een winkel voegt 'm toe/haalt 'm weg uit de selectie (i.p.v. de selectie te vervangen)
  const toggleStoreHref = (slug: string) => {
    const next = new Set(selectedStores);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    return href({ winkel: next.size ? [...next].join(",") : undefined });
  };
  const toggleDietHref = (slug: string) => {
    const next = new Set(selectedDiets);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    return href({ dieet: next.size ? [...next].join(",") : undefined });
  };
  const returnTo = href({ pagina: sp.pagina });

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-6xl px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">Producten</p>
        <h1 className="mt-2 font-display text-3xl font-light text-ink">Het hele assortiment</h1>

        <form action="/producten" className="mt-6 flex gap-2" role="search">
          <label htmlFor="q" className="sr-only">Zoek een product of merk</label>
          <input
            id="q"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Zoek een product of merk, bv. halfvolle melk 1 l"
            className="min-w-0 flex-1 rounded-xl border border-line bg-raised px-4 py-2.5 text-sm text-ink"
          />
          {sp.categorie && <input type="hidden" name="categorie" value={sp.categorie} />}
          {sp.winkel && <input type="hidden" name="winkel" value={sp.winkel} />}
          <button className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-ground">Zoeken</button>
        </form>

        <div className="mt-5 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[0.62rem] uppercase text-muted">Categorie</span>
            <Link href={href({ categorie: undefined })} className={chip(!sp.categorie)}>alle</Link>
            {cats.map((c) => (
              <Link key={c.slug} href={href({ categorie: c.slug })} className={chip(sp.categorie === c.slug)}>{c.name}</Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[0.62rem] uppercase text-muted">Winkel</span>
            <Link href={href({ winkel: undefined })} className={chip(selectedStores.length === 0)}>alle</Link>
            {STORES.map((s) => (
              <Link key={s.slug} href={toggleStoreHref(s.slug)} className={chip(selectedStores.includes(s.slug))}>
                {s.name}
              </Link>
            ))}
            <span className="ml-3 mr-1 font-mono text-[0.62rem] uppercase text-muted">Soort</span>
            <Link href={href({ soort: undefined })} className={chip(!opts.kind)}>alle</Link>
            <Link href={href({ soort: "a" })} className={chip(opts.kind === "a")}>A-merk</Link>
            <Link href={href({ soort: "own" })} className={chip(opts.kind === "own")}>huismerk</Link>
            <Link href={href({ actie: opts.promo ? undefined : "1" })} className={chip(!!opts.promo)}>in de actie</Link>
          </div>
          {brands.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-[0.62rem] uppercase text-muted">Merk</span>
              <Link href={href({ merk: undefined })} className={chip(!sp.merk)}>alle</Link>
              {brands.map((b) => (
                <Link key={b.name} href={href({ merk: b.name })} className={chip(sp.merk?.toLowerCase() === b.name.toLowerCase())}>{b.name}</Link>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[0.62rem] uppercase text-muted">Dieet</span>
            <Link href={href({ dieet: undefined })} className={chip(selectedDiets.length === 0)}>alle</Link>
            {DIET_TAGS.map((t) => (
              <Link key={t.slug} href={toggleDietHref(t.slug)} className={chip(selectedDiets.includes(t.slug))}>
                {t.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[0.62rem] uppercase text-muted">Sorteer</span>
            <Link href={href({ sorteer: undefined })} className={chip(opts.sort === "relevance")}>relevantie</Link>
            <Link href={href({ sorteer: "price" })} className={chip(opts.sort === "price")}>laagste prijs</Link>
            <Link href={href({ sorteer: "stores" })} className={chip(opts.sort === "stores")}>in meeste winkels</Link>
          </div>
        </div>

        <p className="mt-6 text-sm text-muted">{res.total.toLocaleString("nl-NL")} productgroepen</p>

        {res.cards.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-line bg-raised p-8 text-center text-sm text-muted">
            Niets gevonden. Probeer een ander woord of haal een filter weg.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {res.cards.map((c) => {
              const cheapest = Math.min(...c.stores.map((s) => s.cents));
              return (
                <li key={c.slug} className="flex flex-col rounded-2xl border border-line bg-raised p-4">
                  <div className="flex items-start gap-3">
                    <ProductTile product={{ id: c.slug, name: c.name, category: c.category }} brand={null} imageUrl={c.imageUrl} size={46} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/product/${c.slug}`} className="font-semibold text-ink hover:underline">{c.name}</Link>
                      <p className="font-mono text-[0.68rem] text-muted">
                        {c.products} {c.products === 1 ? "product" : "producten"} · {c.brands} {c.brands === 1 ? "merk" : "merken"}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 font-mono text-xs">
                    {c.stores.map((s) => (
                      <li key={s.store} className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-muted">{STORES.find((x) => x.slug === s.store)?.name ?? s.store} · {s.brand}</span>
                        <span className={`tabular-nums ${s.cents === cheapest ? "text-sage" : "text-ink"}`}>
                          {s.promo && <span className="mr-1 rounded-full bg-sage-wash px-1.5 text-[0.6rem] text-sage">actie</span>}
                          {formatEuro(s.cents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    {userId ? (
                      <form action={addToActiveList.bind(null, c.slug)}>
                        <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink hover:bg-ground">+ naar lijst</button>
                      </form>
                    ) : (
                      <Link href={`/inloggen?callbackUrl=${encodeURIComponent(returnTo)}`} className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted">
                        log in om toe te voegen
                      </Link>
                    )}
                    <Link href={`/product/${c.slug}`} className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink hover:bg-ground">Details</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {pages > 1 && (
          <nav className="mt-8 flex items-center justify-center gap-3 text-sm" aria-label="Paginering">
            {page > 1 && <Link href={href({ pagina: String(page - 1) })} className={chip(false)}>← vorige</Link>}
            <span className="font-mono text-xs text-muted">pagina {page} van {pages.toLocaleString("nl-NL")}</span>
            {page < pages && <Link href={href({ pagina: String(page + 1) })} className={chip(false)}>volgende →</Link>}
          </nav>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
