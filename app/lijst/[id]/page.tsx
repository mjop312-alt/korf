import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-chrome";
import { db } from "@/lib/db";
import { getListWithItems, getLists, getUserId, toEngineItems } from "@/lib/lists";
import { SUPERMARKETS } from "@/lib/mock-data";
import { ListEditor } from "./list-editor";

export const dynamic = "force-dynamic";

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const userId = await getUserId();
  if (!userId) redirect(`/inloggen?callbackUrl=/lijst/${id}`);

  const list = await getListWithItems(userId, id);
  if (!list) notFound();

  const [lists, pref] = await Promise.all([
    getLists(userId),
    db.userPreference.findUnique({ where: { userId } }),
  ]);

  const allStoreIds = SUPERMARKETS.map((s) => s.id);
  const prefStores = (pref?.selectedStoreIds as string[] | null) ?? null;
  const initialStores = prefStores?.length
    ? prefStores.filter((s) => allStoreIds.includes(s))
    : allStoreIds;

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <ListEditor
        list={{ id: list.id, name: list.name, isActive: list.isActive }}
        initialItems={toEngineItems(list.items)}
        initialStores={initialStores}
        otherLists={lists
          .filter((l) => l.id !== list.id)
          .map((l) => ({ id: l.id, name: l.name, count: l._count.items }))}
      />
    </div>
  );
}
