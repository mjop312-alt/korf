// Lees-kant van de boodschappenlijsten. Aangeroepen vanuit server components.
// Mutaties staan in lib/list-actions.ts.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { dbToBrandMode } from "@/lib/list-map";
import type { ListItem } from "@/lib/types";

export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Voor mutaties: geeft de user-id terug, of stuurt naar /inloggen.
 * Controleert ook of de gebruiker nog bestaat — een sessie kan verwijzen naar een
 * verwijderde/opnieuw-geseede gebruiker (JWT wordt niet per request geverifieerd).
 */
export async function requireUserId(): Promise<string> {
  const id = await getUserId();
  if (!id) redirect("/inloggen");
  const exists = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) redirect("/inloggen");
  return id;
}

export async function getLists(userId: string) {
  return db.shoppingList.findMany({
    where: { ownerId: userId, archivedAt: null },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    include: { _count: { select: { items: true } } },
  });
}

export async function getArchivedLists(userId: string) {
  return db.shoppingList.findMany({
    where: { ownerId: userId, archivedAt: { not: null } },
    orderBy: { archivedAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
}

export type ListWithItems = NonNullable<Awaited<ReturnType<typeof getListWithItems>>>;

export async function getListWithItems(userId: string, id: string) {
  return db.shoppingList.findFirst({
    where: { id, ownerId: userId },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: { canonicalProduct: true, pinnedBrand: true },
      },
    },
  });
}

/** De actieve lijst van de gebruiker; maakt er één aan als die er nog niet is. */
export async function getOrCreateActiveList(userId: string) {
  const active = await db.shoppingList.findFirst({
    where: { ownerId: userId, isActive: true, archivedAt: null },
  });
  if (active) return active;

  const recent = await db.shoppingList.findFirst({
    where: { ownerId: userId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  if (recent) {
    return db.shoppingList.update({ where: { id: recent.id }, data: { isActive: true } });
  }
  return db.shoppingList.create({ data: { ownerId: userId, name: "Mijn lijst", isActive: true } });
}

type DbItem = ListWithItems["items"][number];

/** DB-lijstregels → invoer voor de scenario-engine. */
export function toEngineItems(items: DbItem[]): ListItem[] {
  return items
    .filter((i) => i.canonicalProduct)
    .map((i) => ({
      id: i.id,
      productId: i.canonicalProduct!.slug,
      quantity: i.quantity,
      brandMode: dbToBrandMode(i.brandMode, i.pinnedBrand?.name ?? null),
    }));
}
