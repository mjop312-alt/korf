"use client";

// Herbruikbare lijst-samensteller. Persistentie-agnostisch: krijgt de items +
// winkelselectie als props en roept callbacks aan bij wijzigingen. Gebruikt door
// de gast-modus (lokale state) en de ingelogde editor (server-actions).

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ProductTile } from "@/components/product-tile";
import { brandChoiceOptions, parseBrandMode, serialiseBrandMode } from "@/lib/catalog";
import { formatEuro } from "@/lib/compare";
import { CATALOG, SUPERMARKETS } from "@/lib/mock-data";
import { tileBrandFor } from "@/lib/product-visuals";
import type { BrandMode, CompareResult, ListItem } from "@/lib/types";

const productBySlug = (slug: string) => CATALOG.find((c) => c.id === slug);

export function ListBuilder({
  items,
  stores,
  onAdd,
  onPatch,
  onRemove,
  onToggleStore,
  note,
  compareHref = "/vergelijk",
}: {
  items: ListItem[];
  stores: string[];
  onAdd: (slug: string) => void;
  onPatch: (id: string, patch: Partial<ListItem>) => void;
  onRemove: (id: string) => void;
  onToggleStore: (slug: string) => void;
  note?: string | null;
  compareHref?: string;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return CATALOG.filter((c) => c.name.toLowerCase().includes(q) || c.category.includes(q)).slice(0, 6);
  }, [query]);

  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, storeIds: stores }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then(setResult)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [items, stores]);

  const best = result?.balanced ?? result?.cheapestSingle ?? result?.maxSplit ?? null;

  return (
    <div className="grid gap-6 md:grid-cols-[1.3fr_0.9fr]">
      {/* samenstellen */}
      <section>
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek een product — melk, koffie, pindakaas…"
            className="w-full rounded-xl border border-line bg-ground px-4 py-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brass"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-line bg-raised shadow-xl">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      onAdd(s.id);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-3 border-t border-line/60 px-3 py-2 text-left first:border-t-0 hover:bg-sunken"
                  >
                    <ProductTile product={s} brand={null} size={34} />
                    <span className="flex-1 font-semibold text-ink">{s.name}</span>
                    <span className="font-mono text-xs text-sage">
                      vanaf {formatEuro(Math.min(...s.variants.map((v) => v.promo?.priceCents ?? v.priceCents)))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SUPERMARKETS.map((s) => {
            const on = stores.includes(s.id);
            return (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm ${
                  on ? "border-brass bg-brass-wash text-ink" : "border-line bg-ground text-muted"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={on} onChange={() => onToggleStore(s.id)} />
                <span className="h-2 w-2 rounded-full" style={{ background: s.brandColor, opacity: on ? 1 : 0.35 }} />
                {s.name}
              </label>
            );
          })}
        </div>

        {note && <p className="mt-2 text-xs text-clay">{note}</p>}

        {items.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-line bg-raised p-6 text-sm text-muted">
            Je lijst is leeg. Zoek hierboven een product om te beginnen.
          </p>
        ) : (
          <ul className="mt-2">
            {items.map((it) => {
              const p = productBySlug(it.productId);
              if (!p) return null;
              const options = brandChoiceOptions(p, stores);
              const tileBrand = tileBrandFor(it, CATALOG, stores).brand;
              return (
                <li key={it.id} className="grid grid-cols-[54px_1fr_auto_auto] items-center gap-3 border-t border-line/60 py-3">
                  <ProductTile product={p} brand={tileBrand} />
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{p.name}</div>
                    <div className="font-mono text-[0.7rem] text-muted">{p.category}</div>
                    <select
                      value={serialiseBrandMode(it.brandMode)}
                      onChange={(e) => onPatch(it.id, { brandMode: parseBrandMode(e.target.value) })}
                      className="mt-1 rounded-lg border border-line bg-ground px-2 py-1 text-xs text-text"
                      aria-label={`Merkkeuze voor ${p.name}`}
                    >
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center overflow-hidden rounded-lg border border-line">
                    <button className="h-8 w-8 bg-ground text-ink" onClick={() => onPatch(it.id, { quantity: Math.max(1, it.quantity - 1) })} aria-label="Minder">−</button>
                    <output className="w-7 text-center font-mono text-sm">{it.quantity}</output>
                    <button className="h-8 w-8 bg-ground text-ink" onClick={() => onPatch(it.id, { quantity: it.quantity + 1 })} aria-label="Meer">+</button>
                  </div>
                  <button
                    className="h-8 w-8 rounded-lg border border-line text-muted hover:border-clay hover:text-clay"
                    onClick={() => onRemove(it.id)}
                    aria-label={`Verwijder ${p.name}`}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* uitkomst */}
      <aside className="space-y-3">
        <h2 className="font-display text-2xl font-normal text-ink">
          Winkelstrategie {loading && <span className="font-mono text-xs text-muted">· rekent…</span>}
        </h2>

        {!result || items.length === 0 ? (
          <p className="rounded-2xl border border-line bg-raised p-6 text-sm text-muted">Voeg producten toe.</p>
        ) : (
          <>
            {([
              ["cheapestSingle", "Goedkoopste winkel", result.cheapestSingle],
              ["balanced", "Beste balans", result.balanced],
              ["maxSplit", "Maximaal splitsen", result.maxSplit],
            ] as const).map(([key, title, data]) => (
              <div
                key={key}
                className={`rounded-2xl border p-4 ${result.recommended === key ? "border-brass bg-brass-wash" : "border-line bg-raised"}`}
              >
                <p className={`font-mono text-[0.6rem] uppercase tracking-widest ${result.recommended === key ? "text-brass" : "text-muted"}`}>
                  {result.recommended === key ? "Aanbevolen" : title}
                </p>
                <p className="font-display text-base text-ink">{title}</p>
                {data ? (
                  <>
                    <p className="mt-1 font-mono text-xl font-medium text-ink tabular-nums">{formatEuro(data.totalCents)}</p>
                    <p className="font-mono text-xs text-sage">
                      {data.savingCents > 0 ? `bespaart ${formatEuro(data.savingCents)}` : "geen besparing"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {data.storeIds.map((id) => SUPERMARKETS.find((s) => s.id === id)?.name).join(" + ")}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-muted">{stores.length < 2 ? "Kies ≥ 2 winkels." : "n.v.t."}</p>
                )}
              </div>
            ))}
            {best && (
              <p className="text-xs text-muted">
                Besparing t.o.v. {result.referenceLabel}. Demodata.{" "}
                <Link href={compareHref} className="text-brass underline underline-offset-2">
                  volledige vergelijking →
                </Link>
              </p>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
