"use client";

// Editor voor een lijst waar je via een "samen bewerken"-link bij kwam (geen eigenaar). Zelfde
// bouwstenen als de eigen lijst-editor, maar zonder eigenaars-only acties (naam, dupliceren,
// archiveren, nieuwe deel-link) — die blijven bij de eigenaar.

import { useEffect, useRef, useState } from "react";
import { ListBuilder } from "@/components/list-builder";
import { useProductCache } from "@/components/use-product-cache";
import { isBrandModeAvailable } from "@/lib/catalog";
import { addItemBySlug, removeItem, setListStores, updateItem } from "@/lib/list-actions";
import type { CanonicalProduct, ListItem } from "@/lib/types";
import { useActionQueue } from "@/lib/use-action-queue";

export function SharedListEditor({
  listId,
  ownerName,
  initialItems,
  initialProducts,
  initialStores,
}: {
  listId: string;
  ownerName: string;
  initialItems: ListItem[];
  initialProducts: CanonicalProduct[];
  initialStores: string[];
}) {
  const enqueue = useActionQueue();

  const [items, setItems] = useState(initialItems);
  const itemsKey = initialItems.map((i) => `${i.id}:${i.quantity}:${JSON.stringify(i.brandMode)}`).join("|");
  const lastKey = useRef(itemsKey);
  useEffect(() => {
    if (lastKey.current !== itemsKey) {
      setItems(initialItems);
      lastKey.current = itemsKey;
    }
  }, [itemsKey, initialItems]);

  const { products, learn } = useProductCache(initialProducts);
  const [stores, setStores] = useState(initialStores);
  const [note, setNote] = useState<string | null>(
    `Je bewerkt de gedeelde lijst van ${ownerName} — wijzigingen zijn voor iedereen met deze link zichtbaar.`,
  );

  const run = (fn: () => Promise<unknown>) => enqueue(fn);

  const add = (slug: string) => {
    setNote(null);
    setItems((prev) => {
      const found = prev.find((i) => i.productId === slug);
      if (found) return prev.map((i) => (i === found ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { id: `tmp-${slug}-${Date.now()}`, productId: slug, quantity: 1, brandMode: "any" }];
    });
    run(() => addItemBySlug(listId, slug));
  };

  const patch = (id: string, p: Partial<ListItem>) => {
    setNote(null);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
    if (!id.startsWith("tmp-")) run(() => updateItem(listId, id, p));
  };

  const remove = (id: string) => {
    setNote(null);
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (!id.startsWith("tmp-")) run(() => removeItem(listId, id));
  };

  const toggleStore = (id: string) => {
    setNote(null);
    setStores((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      enqueue(() => setListStores(listId, next));
      return next;
    });
  };

  useEffect(() => {
    const impossible = items.filter((it) => {
      const p = products[it.productId];
      return p && !isBrandModeAvailable(it.brandMode, p, stores);
    });
    if (!impossible.length) return;
    setItems((prev) => prev.map((i) => (impossible.some((x) => x.id === i.id) ? { ...i, brandMode: "any" } : i)));
    for (const it of impossible) {
      if (!it.id.startsWith("tmp-")) run(() => updateItem(listId, it.id, { brandMode: "any" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores]);

  return (
    <ListBuilder
      items={items}
      stores={stores}
      products={products}
      onLearn={learn}
      onAdd={add}
      onPatch={patch}
      onRemove={remove}
      onToggleStore={toggleStore}
      note={note}
      compareHref={`/vergelijk?lijst=${listId}`}
    />
  );
}
