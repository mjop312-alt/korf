"use client";

import { useCallback, useState } from "react";
import type { CanonicalProduct } from "@/lib/types";

/**
 * Cache van productgroepen (slug → groep met varianten) voor de lijstbouwer. Begint met wat
 * de server al meegaf (de producten op de lijst) en groeit mee met wat je zoekt en toevoegt.
 */
export function useProductCache(initial: CanonicalProduct[] = []) {
  const [products, setProducts] = useState<Record<string, CanonicalProduct>>(() =>
    Object.fromEntries(initial.map((p) => [p.id, p])),
  );

  const learn = useCallback((found: CanonicalProduct[]) => {
    if (!found.length) return;
    setProducts((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const p of found) {
        if (!next[p.id]) {
          next[p.id] = p;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  return { products, learn };
}
