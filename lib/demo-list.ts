// Voorbeeldlijst voor bezoekers zonder account (bv. /vergelijk zonder ?lijst=): samengesteld
// uit échte producten uit de catalogus, gevonden via zoektermen. Een uur gecachet — de
// zoekopdrachten zijn te traag om bij elke paginaweergave te draaien.

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { findGroupSlug } from "@/lib/catalog-search";
import type { ListItem } from "@/lib/types";

const DEMO_TERMS: [string, number][] = [
  ["halfvolle melk 1 l", 2],
  ["roomboter 250 g", 1],
  ["yoghurt 1 l", 1],
  ["chips", 2],
  ["appelsap 1 l", 1],
  ["kipfilet", 1],
  ["spaghetti 500 g", 1],
  ["pindakaas 350 g", 1],
];

export const getDemoList = unstable_cache(
  async (): Promise<ListItem[]> => {
    const items: ListItem[] = [];
    for (const [term, quantity] of DEMO_TERMS) {
      const slug = await findGroupSlug(db, term);
      if (slug) items.push({ id: `demo-${items.length + 1}`, productId: slug, quantity, brandMode: "any" });
    }
    return items;
  },
  ["demo-list"],
  { revalidate: 3600, tags: ["catalog"] },
);
