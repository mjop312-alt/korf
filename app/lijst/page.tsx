// /lijst — ingelogd: door naar je actieve lijst. Uitgelogd: de gast-samensteller
// (zonder opslaan), zodat een eerste bezoeker het meteen kan proberen.

import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-chrome";
import { loadGroups } from "@/lib/catalog-db";
import { getDemoList } from "@/lib/demo-list";
import { getOrCreateActiveList, getUserId } from "@/lib/lists";
import { GuestListBuilder } from "./guest-list-builder";

export const dynamic = "force-dynamic";

export default async function LijstPage() {
  const userId = await getUserId();
  if (userId) {
    const list = await getOrCreateActiveList(userId);
    redirect(`/lijst/${list.id}`);
  }

  // een bezoeker begint met een voorbeeldlijst van echte producten
  const demo = await getDemoList();
  const initialItems = demo.slice(0, 4).map((it, i) => ({ ...it, id: `guest-${i}` }));
  const initialProducts = await loadGroups(initialItems.map((i) => i.productId));

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <GuestListBuilder initialItems={initialItems} initialProducts={initialProducts} />
    </div>
  );
}
