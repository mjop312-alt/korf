"use client";

import { useState } from "react";
import { formatEuro } from "@/lib/compare";
import { clearChecked, recordSavingsSnapshot, updateItem } from "@/lib/list-actions";
import type { BrandMode } from "@/lib/types";
import { useActionQueue } from "@/lib/use-action-queue";

interface ChecklistItem {
  id: string;
  label: string;
  quantity: number;
  brandMode: BrandMode;
  priceCents: number | null;
  checked: boolean;
}
interface ChecklistGroup {
  storeId: string;
  storeName: string;
  storeColor: string;
  items: ChecklistItem[];
}

const brandLabel = (m: BrandMode) => (m === "any" ? "" : m === "own" ? "huismerk" : m === "a_brand" ? "A-merk" : m.brand);

interface TripSnapshot {
  listName: string;
  totalCents: number;
  savingCents: number;
  referenceLabel: string;
  storeLabel: string;
  itemCount: number;
}

export function ShoppingChecklist({
  listId,
  groups: initial,
  snapshot,
}: {
  listId: string;
  groups: ChecklistGroup[];
  snapshot: TripSnapshot;
}) {
  const [groups, setGroups] = useState(initial);
  // acties na elkaar sturen (nooit gelijktijdig) — voorkomt dat snel-achter-elkaar
  // aangevinkte regels elkaars server-schrijfactie overschrijven
  const enqueue = useActionQueue();

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const checked = groups.reduce((n, g) => n + g.items.filter((i) => i.checked).length, 0);

  function toggle(itemId: string) {
    let next = false;
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((i) => {
          if (i.id !== itemId) return i;
          next = !i.checked;
          return { ...i, checked: next };
        }),
      })),
    );
    enqueue(() => updateItem(listId, itemId, { checked: next }));
  }

  function removeChecked() {
    // alles afgevinkt en tegelijk weggehaald = de hele trip is klaar — voor de besparingsgeschiedenis
    if (checked === total && total > 0) {
      enqueue(() => recordSavingsSnapshot(listId, snapshot));
    }
    setGroups((prev) =>
      prev.map((g) => ({ ...g, items: g.items.filter((i) => !i.checked) })).filter((g) => g.items.length > 0),
    );
    enqueue(() => clearChecked(listId));
  }

  if (total === 0) {
    return <p className="mt-8 rounded-2xl border border-line bg-raised p-6 text-center text-sm text-muted">Alles afgevinkt — klaar! 🎉</p>;
  }

  return (
    <div className="mt-6">
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-sage transition-[width]"
          style={{ width: `${total ? (checked / total) * 100 : 0}%` }}
        />
      </div>
      <p className="mt-1.5 font-mono text-xs text-muted">{checked}/{total} afgevinkt</p>

      <div className="mt-6 space-y-6">
        {groups.map((g) => (
          <div key={g.storeId}>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.storeColor }} />
              <h2 className="font-display text-lg text-ink">{g.storeName}</h2>
              <span className="font-mono text-xs text-muted">{g.items.length}</span>
            </div>
            <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-raised">
              {g.items.map((i) => (
                <li key={i.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={i.checked}
                      onChange={() => toggle(i.id)}
                      className="h-4 w-4 accent-[var(--color-brass)]"
                    />
                    <span className={`flex-1 text-sm ${i.checked ? "text-muted line-through" : "text-ink"}`}>
                      {i.label} <span className="font-mono text-xs">×{i.quantity}</span>
                      {brandLabel(i.brandMode) && (
                        <span className="ml-1 font-mono text-[0.65rem] text-muted">({brandLabel(i.brandMode)})</span>
                      )}
                    </span>
                    {i.priceCents != null && (
                      <span className="font-mono text-xs tabular-nums text-muted">{formatEuro(i.priceCents)}</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <button
          onClick={removeChecked}
          disabled={checked === 0}
          className="rounded-xl border border-line px-4 py-2.5 text-sm text-ink hover:bg-ground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Afgevinkte producten weghalen
        </button>
      </div>
    </div>
  );
}
