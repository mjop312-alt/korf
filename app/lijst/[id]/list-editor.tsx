"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListBuilder } from "@/components/list-builder";
import { ShareListDialog } from "@/components/share-list-dialog";
import { isBrandModeAvailable } from "@/lib/catalog";
import {
  addItemBySlug,
  archiveList,
  duplicateList,
  removeItem,
  renameList,
  setActiveList,
  setListStores,
  updateItem,
} from "@/lib/list-actions";
import { CATALOG } from "@/lib/mock-data";
import type { BrandMode, ListItem } from "@/lib/types";
import { useActionQueue } from "@/lib/use-action-queue";

type Summary = { id: string; name: string; isActive: boolean };

export function ListEditor({
  list,
  initialItems,
  initialStores,
  otherLists,
}: {
  list: Summary;
  initialItems: ListItem[];
  initialStores: string[];
  otherLists: { id: string; name: string; count: number }[];
}) {
  const router = useRouter();
  const enqueue = useActionQueue();

  // items volgen de server; stores + note zijn lokaal
  const [items, setItems] = useState(initialItems);
  const itemsKey = initialItems.map((i) => `${i.id}:${i.quantity}:${JSON.stringify(i.brandMode)}`).join("|");
  const lastKey = useRef(itemsKey);
  useEffect(() => {
    if (lastKey.current !== itemsKey) {
      setItems(initialItems);
      lastKey.current = itemsKey;
    }
  }, [itemsKey, initialItems]);

  const [stores, setStores] = useState(initialStores);
  const [note, setNote] = useState<string | null>(null);

  // acties na elkaar (nooit gelijktijdig) sturen — snel-achter-elkaar wijzigingen
  // (bv. meerdere merkkeuzes die tegelijk terugvallen op "any") mogen elkaar niet overschrijven
  const run = (fn: () => Promise<unknown>) =>
    enqueue(async () => {
      await fn();
      router.refresh();
    });

  const add = (slug: string) => {
    setItems((prev) => {
      const found = prev.find((i) => i.productId === slug);
      if (found) return prev.map((i) => (i === found ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { id: `tmp-${slug}-${Date.now()}`, productId: slug, quantity: 1, brandMode: "any" }];
    });
    run(() => addItemBySlug(list.id, slug));
  };

  const patch = (id: string, p: Partial<ListItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
    if (!id.startsWith("tmp-")) run(() => updateItem(list.id, id, p));
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (!id.startsWith("tmp-")) run(() => removeItem(list.id, id));
  };

  const toggleStore = (id: string) => {
    setNote(null);
    setStores((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      enqueue(() => setListStores(list.id, next));
      return next;
    });
  };

  // merkkeuzes die niet meer kunnen bij de gekozen winkels → terug naar "maakt niet uit" (ook op de server)
  useEffect(() => {
    const impossible = items.filter((it) => {
      const p = CATALOG.find((c) => c.id === it.productId);
      return p && !isBrandModeAvailable(it.brandMode, p, stores);
    });
    if (!impossible.length) return;
    setItems((prev) => prev.map((i) => (impossible.some((x) => x.id === i.id) ? { ...i, brandMode: "any" } : i)));
    setNote(`${impossible.length} merkkeuze${impossible.length > 1 ? "s" : ""} teruggezet — niet bij deze winkels.`);
    for (const it of impossible) {
      if (!it.id.startsWith("tmp-")) run(() => updateItem(list.id, it.id, { brandMode: "any" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores]);

  return (
    <main id="main-content" className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/lijsten" className="font-mono text-xs text-muted hover:text-ink">← alle lijsten</Link>

      <header className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <input
              defaultValue={list.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== list.name) run(() => renameList(list.id, v));
              }}
              aria-label="Lijstnaam"
              className="rounded-md border-0 bg-transparent font-display text-2xl text-ink outline-none focus-visible:ring-2 focus-visible:ring-brass"
            />
            {list.isActive ? (
              <span className="rounded-full border border-brass px-2 py-0.5 font-mono text-[0.6rem] uppercase text-brass">
                actief
              </span>
            ) : (
              <button
                onClick={() => run(() => setActiveList(list.id))}
                className="font-mono text-xs text-brass underline underline-offset-2"
              >
                als actief instellen
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={`/vergelijk?lijst=${list.id}`} className="rounded-xl bg-ink px-4 py-2 font-medium text-ground">
            Vergelijk prijzen
          </Link>
          <button onClick={() => run(() => duplicateList(list.id))} className="rounded-xl border border-line px-3 py-2 text-ink">
            Dupliceer
          </button>
          <ShareListDialog listId={list.id} />
          <button
            onClick={() => {
              if (confirm("Deze lijst archiveren?")) run(() => archiveList(list.id));
            }}
            className="rounded-xl border border-line px-3 py-2 text-muted hover:border-clay hover:text-clay"
          >
            Archiveer
          </button>
        </div>
      </header>

      {otherLists.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">Andere lijsten:</span>
          {otherLists.map((l) => (
            <Link
              key={l.id}
              href={`/lijst/${l.id}`}
              className="rounded-full border border-line px-2.5 py-0.5 text-ink hover:bg-raised"
            >
              {l.name} · {l.count}
            </Link>
          ))}
        </div>
      )}

      <ListBuilder
        items={items}
        stores={stores}
        onAdd={add}
        onPatch={patch}
        onRemove={remove}
        onToggleStore={toggleStore}
        note={note}
        compareHref={`/vergelijk?lijst=${list.id}`}
      />
    </main>
  );
}
