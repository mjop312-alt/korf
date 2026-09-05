"use client";

// StoreSelector — vink aan welke supermarkten meedoen. Schrijft de selectie naar
// ?winkels= in de URL; de server component herberekent dan alle scenario's.

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Supermarket } from "@/lib/types";

export function StoreSelector({ all, selected }: { all: Supermarket[]; selected: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    const q = new URLSearchParams(params);
    if (next.length && next.length < all.length) q.set("winkels", next.join(","));
    else q.delete("winkels");
    startTransition(() => router.replace(`/vergelijk?${q.toString()}`, { scroll: false }));
  }

  return (
    <div className={`flex flex-wrap gap-2 ${pending ? "opacity-60" : ""}`} role="group" aria-label="Winkels om te vergelijken">
      {all.map((s) => {
        const on = selected.includes(s.id);
        return (
          <label
            key={s.id}
            className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm select-none ${
              on ? "border-brass bg-brass-wash text-ink" : "border-line bg-ground text-muted"
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={on}
              onChange={() => toggle(s.id)}
            />
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: s.brandColor, opacity: on ? 1 : 0.35 }}
            />
            {s.name}
          </label>
        );
      })}
    </div>
  );
}
