"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListBuilder } from "@/components/list-builder";
import { isBrandModeAvailable } from "@/lib/catalog";
import { CATALOG, SUPERMARKETS } from "@/lib/mock-data";
import type { BrandMode, ListItem } from "@/lib/types";

const uid = () => Math.random().toString(36).slice(2, 9);
const START: ListItem[] = [
  { id: uid(), productId: "melk", quantity: 2, brandMode: "any" },
  { id: uid(), productId: "brood", quantity: 1, brandMode: "any" },
  { id: uid(), productId: "koffie", quantity: 1, brandMode: "any" },
  { id: uid(), productId: "pindakaas", quantity: 1, brandMode: { brand: "Calvé" } },
];

export function GuestListBuilder() {
  const [items, setItems] = useState<ListItem[]>(START);
  const [stores, setStores] = useState<string[]>(SUPERMARKETS.map((s) => s.id));
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setItems((prev) => {
      let changed = 0;
      const next = prev.map((it) => {
        const p = CATALOG.find((c) => c.id === it.productId);
        if (!p || isBrandModeAvailable(it.brandMode, p, stores)) return it;
        changed++;
        return { ...it, brandMode: "any" as BrandMode };
      });
      if (changed) setNote(`${changed} merkkeuze${changed > 1 ? "s" : ""} teruggezet — niet bij deze winkels.`);
      return changed ? next : prev;
    });
  }, [stores]);

  const add = (slug: string) =>
    setItems((prev) => {
      const found = prev.find((i) => i.productId === slug);
      if (found) return prev.map((i) => (i === found ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { id: uid(), productId: slug, quantity: 1, brandMode: "any" }];
    });
  const patch = (id: string, p: Partial<ListItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const toggleStore = (id: string) => {
    setNote(null);
    setStores((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-normal text-ink">Je lijst</h1>
        <span className="font-mono text-xs text-muted">
          {items.length} {items.length === 1 ? "product" : "producten"}
        </span>
      </div>

      <div className="mb-5 rounded-xl border border-brass bg-brass-wash px-4 py-3 text-sm text-text">
        Je bent niet ingelogd — deze lijst wordt niet bewaard.{" "}
        <Link href="/registreren" className="font-medium text-brass underline underline-offset-2">Maak een account</Link>{" "}
        of <Link href="/inloggen" className="text-brass underline underline-offset-2">log in</Link>.
      </div>

      <ListBuilder
        items={items}
        stores={stores}
        onAdd={add}
        onPatch={patch}
        onRemove={remove}
        onToggleStore={toggleStore}
        note={note}
      />
    </main>
  );
}
