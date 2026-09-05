// Korf — scenario-engine. Pure functies, geen I/O, geen framework.
// Draait server-side op prijzen die AL in de database staan (elke prijs heeft een
// collected_at); nooit een live-call in het request-pad.
//
// Uitbouw van `compare.js` uit het "boodschatje"-prototype:
//   + winkelselectie (alleen vergelijken met aangevinkte winkels)
//   + merkvoorkeur per regel (any / vastgezet merk / alleen huismerk)
//   + scenario C "Beste balans" (greedy, max N winkels)
//   + expliciete besparing t.o.v. een referentie-hoofdwinkel

import type {
  CanonicalProduct,
  Candidate,
  CompareOptions,
  CompareResult,
  CompareRow,
  ListItem,
  Scenario,
  StoreId,
  StoreProduct,
  Supermarket,
} from "./types";

export function effectiveCents(v: StoreProduct): number {
  return v.promo && v.promo.priceCents != null ? v.promo.priceCents : v.priceCents;
}

function matchesBrand(item: ListItem, v: StoreProduct): boolean {
  if (item.brandMode === "any") return true;
  if (item.brandMode === "own") return v.ownBrand;
  return v.brand === item.brandMode.brand;
}

function pickCandidate(
  item: ListItem,
  storeId: StoreId,
  product: CanonicalProduct,
): Candidate | null {
  const variants = product.variants
    .filter((v) => v.store === storeId && matchesBrand(item, v))
    .sort(
      (a, b) =>
        effectiveCents(a) - effectiveCents(b) ||
        (a.ownBrand === b.ownBrand ? 0 : a.ownBrand ? -1 : 1),
    );
  if (variants.length === 0) return null;
  const v = variants[0];
  return {
    storeId,
    title: `${v.brand} ${product.name}`,
    brand: v.brand,
    ownBrand: v.ownBrand,
    effectiveCents: effectiveCents(v),
    regularCents: v.priceCents,
    unitPriceCents: v.unitPriceCents ?? null,
    promo: v.promo ?? null,
    lineCents: effectiveCents(v) * item.quantity,
  };
}

export function compareList(
  items: ListItem[],
  catalog: CanonicalProduct[],
  supermarkets: Supermarket[],
  options: CompareOptions,
): CompareResult {
  const storeIds = options.storeIds;
  const maxBalanced = options.maxStoresBalanced ?? 2;
  // "Beste balans" opent alleen een extra winkel als het minstens dit scheelt.
  const minExtraStoreSavingCents = options.minExtraStoreSavingCents ?? 200;
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const storeName = (id: StoreId) => supermarkets.find((s) => s.id === id)?.name ?? id;

  const empty: CompareResult = {
    rows: [],
    perStoreTotals: {},
    complete: [],
    cheapestSingle: null,
    balanced: null,
    maxSplit: null,
    recommended: null,
    referenceTotalCents: 0,
    referenceLabel: "",
    warnings: [],
  };
  if (items.length === 0 || storeIds.length === 0) return empty;

  // 1 — kandidaat per item x winkel
  const grid = new Map<string, Map<StoreId, Candidate | null>>();
  for (const it of items) {
    const product = byId.get(it.productId);
    const row = new Map<StoreId, Candidate | null>();
    for (const s of storeIds) row.set(s, product ? pickCandidate(it, s, product) : null);
    grid.set(it.id, row);
  }

  // goedkoopste winkel per item
  const cheapest = new Map<string, { storeId: StoreId; lineCents: number } | null>();
  for (const it of items) {
    let best: { storeId: StoreId; lineCents: number } | null = null;
    for (const s of storeIds) {
      const c = grid.get(it.id)!.get(s);
      if (c && (!best || c.lineCents < best.lineCents)) best = { storeId: s, lineCents: c.lineCents };
    }
    cheapest.set(it.id, best);
  }

  // totalen per winkel + winkels die alles hebben
  const perStoreTotals: CompareResult["perStoreTotals"] = {};
  const complete: CompareResult["complete"] = [];
  for (const s of storeIds) {
    let totalCents = 0;
    let missing = 0;
    for (const it of items) {
      const c = grid.get(it.id)!.get(s);
      if (!c) missing++;
      else totalCents += c.lineCents;
    }
    perStoreTotals[s] = { totalCents, missing };
    if (missing === 0) complete.push({ storeId: s, totalCents });
  }
  complete.sort((a, b) => a.totalCents - b.totalCents);

  const multi = storeIds.length >= 2;
  const splittable = items.every((it) => cheapest.get(it.id));

  // 2 — Scenario A: goedkoopste winkel die alles heeft
  const cheapestSingle: Scenario | null = complete[0]
    ? {
        storeIds: [complete[0].storeId],
        totalCents: complete[0].totalCents,
        savingCents: 0,
        assignment: Object.fromEntries(items.map((it) => [it.id, complete[0].storeId])),
      }
    : null;

  // 3 — Scenario B: elk item bij de goedkoopste winkel, ongeacht het aantal winkels
  let maxSplit: Scenario | null = null;
  if (multi && splittable) {
    let totalCents = 0;
    const used = new Set<StoreId>();
    const assignment: Record<string, StoreId> = {};
    for (const it of items) {
      const ch = cheapest.get(it.id)!;
      totalCents += ch.lineCents;
      used.add(ch.storeId);
      assignment[it.id] = ch.storeId;
    }
    maxSplit = { storeIds: [...used], totalCents, savingCents: 0, assignment };
  }

  // 4 — Scenario C "Beste balans": goedkoopst haalbaar met hooguit `maxBalanced` winkels,
  //     en alleen een tweede winkel openen als dat minstens `minExtraStoreSavingCents` scheelt.
  let balanced: Scenario | null = null;
  if (multi && splittable) {
    const base =
      cheapestSingle?.storeIds[0] ??
      [...storeIds].sort(
        (a, b) =>
          perStoreTotals[a].missing - perStoreTotals[b].missing ||
          perStoreTotals[a].totalCents - perStoreTotals[b].totalCents,
      )[0];

    const assign = new Map<string, StoreId>();
    for (const it of items) {
      assign.set(it.id, grid.get(it.id)!.get(base) ? base : cheapest.get(it.id)!.storeId);
    }
    const involved = () => new Set(assign.values());

    for (let guard = 0; guard < storeIds.length; guard++) {
      let bestMove: { moves: string[]; storeId: StoreId; net: number } | null = null;
      for (const s of storeIds) {
        if (involved().size >= maxBalanced && !involved().has(s)) continue;
        let saving = 0;
        const moves: string[] = [];
        for (const it of items) {
          const cur = grid.get(it.id)!.get(assign.get(it.id)!);
          const alt = grid.get(it.id)!.get(s);
          if (alt && cur && alt.lineCents < cur.lineCents) {
            saving += cur.lineCents - alt.lineCents;
            moves.push(it.id);
          }
        }
        if (moves.length === 0) continue;
        const projected = new Set(
          [...assign.entries()].map(([id, st]) => (moves.includes(id) ? s : st)),
        );
        if (projected.size > maxBalanced) continue;
        const opensNewStore = projected.size > involved().size;
        const threshold = opensNewStore ? minExtraStoreSavingCents : 1;
        if (saving >= threshold && (!bestMove || saving > bestMove.net)) {
          bestMove = { moves, storeId: s, net: saving };
        }
      }
      if (!bestMove) break;
      for (const id of bestMove.moves) assign.set(id, bestMove.storeId);
    }

    let totalCents = 0;
    for (const it of items) totalCents += grid.get(it.id)!.get(assign.get(it.id)!)!.lineCents;
    balanced = {
      storeIds: [...involved()],
      totalCents,
      savingCents: 0,
      assignment: Object.fromEntries(assign),
    };
  }

  // referentie = de duurste "hoofdwinkel": alles daar halen, gaten vullen bij de
  // goedkoopste andere winkel. Altijd een reële bovengrens voor de besparing.
  let referenceTotalCents = 0;
  let referenceLabel = "";
  for (const s of storeIds) {
    let full = 0;
    for (const it of items) {
      const c = grid.get(it.id)!.get(s);
      full += c ? c.lineCents : (cheapest.get(it.id)?.lineCents ?? 0);
    }
    if (full > referenceTotalCents) {
      referenceTotalCents = full;
      referenceLabel = storeName(s);
    }
  }

  for (const sc of [cheapestSingle, maxSplit, balanced]) {
    if (sc) sc.savingCents = Math.max(0, referenceTotalCents - sc.totalCents);
  }

  const recommended: CompareResult["recommended"] =
    balanced && (!cheapestSingle || balanced.totalCents < cheapestSingle.totalCents - 1)
      ? "balanced"
      : cheapestSingle
        ? "cheapestSingle"
        : null;

  const rows: CompareRow[] = items.map((it) => {
    const product = byId.get(it.productId);
    const perStore: CompareRow["perStore"] = {};
    for (const s of storeIds) {
      const c = grid.get(it.id)!.get(s);
      perStore[s] =
        c ?? { missing: true, reason: it.brandMode === "any" ? "geen treffer" : "niet in dit merk" };
    }
    return {
      itemId: it.id,
      label: product?.name ?? it.productId,
      quantity: it.quantity,
      brandMode: it.brandMode,
      perStore,
      cheapestStoreId: cheapest.get(it.id)?.storeId ?? null,
    };
  });

  const warnings: string[] = [];
  for (const s of storeIds) {
    const { missing } = perStoreTotals[s];
    if (missing > 0 && missing < items.length) {
      warnings.push(`${storeName(s)} mist ${missing} product(en)`);
    }
  }

  return {
    rows,
    perStoreTotals,
    complete,
    cheapestSingle,
    balanced,
    maxSplit,
    recommended,
    referenceTotalCents,
    referenceLabel,
    warnings,
  };
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}
