"use server";

// Mutaties op boodschappenlijsten. Elke actie: auth-check → eigenaarscheck →
// wijziging → revalidatePath.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { brandModeToDb, LIST_TEMPLATES } from "@/lib/list-map";
import { getOrCreateActiveList, requireUserId } from "@/lib/lists";
import type { BrandMode } from "@/lib/types";

async function assertOwns(userId: string, listId: string) {
  const list = await db.shoppingList.findFirst({ where: { id: listId, ownerId: userId } });
  if (!list) throw new Error("NOT_FOUND");
  return list;
}

/* ─────────────── lijst-niveau ─────────────── */

export async function createList(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  const templateKey = String(formData.get("template") ?? "").trim() || null;

  const list = await db.shoppingList.create({
    data: { ownerId: userId, name: name || (templateKey ? LIST_TEMPLATES[templateKey]?.label : null) || "Nieuwe lijst", templateKey },
  });

  if (templateKey && LIST_TEMPLATES[templateKey]) {
    const slugs = LIST_TEMPLATES[templateKey].slugs;
    const products = await db.canonicalProduct.findMany({ where: { slug: { in: slugs } } });
    const bySlug = new Map(products.map((p) => [p.slug, p]));
    await db.shoppingListItem.createMany({
      data: slugs
        .map((slug, i) => bySlug.get(slug))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p, i) => ({
          listId: list.id,
          rawText: p.name,
          canonicalProductId: p.id,
          categoryId: p.categoryId,
          quantity: 1,
          unit: p.baseUnit,
          position: i,
        })),
    });
  }

  revalidatePath("/lijsten");
  redirect(`/lijst/${list.id}`);
}

export async function renameList(listId: string, name: string) {
  const userId = await requireUserId();
  await assertOwns(userId, listId);
  await db.shoppingList.update({
    where: { id: listId },
    data: { name: name.trim() || "Naamloze lijst" },
  });
  revalidatePath("/lijsten");
  revalidatePath(`/lijst/${listId}`);
}

export async function setActiveList(listId: string) {
  const userId = await requireUserId();
  await assertOwns(userId, listId);
  await db.$transaction([
    db.shoppingList.updateMany({ where: { ownerId: userId, isActive: true }, data: { isActive: false } }),
    db.shoppingList.update({ where: { id: listId }, data: { isActive: true } }),
  ]);
  revalidatePath("/lijsten");
  revalidatePath("/dashboard");
}

export async function archiveList(listId: string) {
  const userId = await requireUserId();
  await assertOwns(userId, listId);
  await db.shoppingList.update({
    where: { id: listId },
    data: { archivedAt: new Date(), isActive: false },
  });
  revalidatePath("/lijsten");
  redirect("/lijsten");
}

export async function setListStores(listId: string, storeIds: string[]) {
  const userId = await requireUserId();
  await assertOwns(userId, listId);
  await db.shoppingList.update({ where: { id: listId }, data: { storeIds } });
  revalidatePath(`/lijst/${listId}`);
}

export async function unarchiveList(listId: string) {
  const userId = await requireUserId();
  await assertOwns(userId, listId);
  await db.shoppingList.update({ where: { id: listId }, data: { archivedAt: null } });
  revalidatePath("/lijsten");
}

export async function deleteList(listId: string) {
  const userId = await requireUserId();
  await assertOwns(userId, listId);
  await db.shoppingList.delete({ where: { id: listId } });
  revalidatePath("/lijsten");
  redirect("/lijsten");
}

export async function duplicateList(listId: string) {
  const userId = await requireUserId();
  const src = await db.shoppingList.findFirst({
    where: { id: listId, ownerId: userId },
    include: { items: true },
  });
  if (!src) throw new Error("NOT_FOUND");

  const copy = await db.shoppingList.create({
    data: { ownerId: userId, name: `Kopie van ${src.name}`, templateKey: src.templateKey },
  });
  if (src.items.length) {
    await db.shoppingListItem.createMany({
      data: src.items.map((i) => ({
        listId: copy.id,
        rawText: i.rawText,
        canonicalProductId: i.canonicalProductId,
        categoryId: i.categoryId,
        quantity: i.quantity,
        unit: i.unit,
        brandMode: i.brandMode,
        pinnedBrandId: i.pinnedBrandId,
        position: i.position,
      })),
    });
  }
  revalidatePath("/lijsten");
  redirect(`/lijst/${copy.id}`);
}

/* ─────────────── regel-niveau ─────────────── */

export async function addItemBySlug(listId: string, slug: string) {
  const userId = await requireUserId();
  await assertOwns(userId, listId);

  const cp = await db.canonicalProduct.findUnique({ where: { slug } });
  if (!cp) throw new Error("PRODUCT_NOT_FOUND");

  const existing = await db.shoppingListItem.findFirst({
    where: { listId, canonicalProductId: cp.id },
  });
  if (existing) {
    await db.shoppingListItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + 1 },
    });
  } else {
    const [agg, pref] = await Promise.all([
      db.shoppingListItem.aggregate({ where: { listId }, _max: { position: true } }),
      db.userPreference.findUnique({ where: { userId }, select: { defaultBrandMode: true } }),
    ]);
    await db.shoppingListItem.create({
      data: {
        listId,
        rawText: cp.name,
        canonicalProductId: cp.id,
        categoryId: cp.categoryId,
        quantity: 1,
        unit: cp.baseUnit,
        brandMode:
          pref?.defaultBrandMode === "prefer_own"
            ? "own_brand"
            : pref?.defaultBrandMode === "always_a_brand"
              ? "a_brand"
              : "any",
        position: (agg._max.position ?? -1) + 1,
      },
    });
  }
  revalidatePath(`/lijst/${listId}`);
}

export async function updateItem(
  listId: string,
  itemId: string,
  patch: { quantity?: number; brandMode?: BrandMode; checked?: boolean },
) {
  const userId = await requireUserId();
  await assertOwns(userId, listId);

  const data: Record<string, unknown> = {};
  if (typeof patch.quantity === "number") data.quantity = Math.max(1, Math.round(patch.quantity));
  if (typeof patch.checked === "boolean") data.checked = patch.checked;
  if (patch.brandMode !== undefined) {
    const mapped = brandModeToDb(patch.brandMode);
    data.brandMode = mapped.brandMode;
    data.pinnedBrandId = mapped.brandName
      ? (await db.brand.findUnique({ where: { name: mapped.brandName } }))?.id ?? null
      : null;
  }

  await db.shoppingListItem.updateMany({ where: { id: itemId, listId }, data });
  revalidatePath(`/lijst/${listId}`);
}

export async function removeItem(listId: string, itemId: string) {
  const userId = await requireUserId();
  await assertOwns(userId, listId);
  await db.shoppingListItem.deleteMany({ where: { id: itemId, listId } });
  revalidatePath(`/lijst/${listId}`);
}

/** Voeg een product toe aan je actieve lijst (vanaf /aanbiedingen of /product). */
export async function addToActiveList(slug: string) {
  const userId = await requireUserId();
  const list = await getOrCreateActiveList(userId);
  await addItemBySlug(list.id, slug);
  revalidatePath("/aanbiedingen");
  revalidatePath(`/product/${slug}`);
}

export async function clearChecked(listId: string) {
  const userId = await requireUserId();
  await assertOwns(userId, listId);
  await db.shoppingListItem.deleteMany({ where: { listId, checked: true } });
  revalidatePath(`/lijst/${listId}`);
}

/** Legt een afgeronde boodschappentrip vast voor de besparingsgeschiedenis op het dashboard. */
export async function recordSavingsSnapshot(
  listId: string,
  snapshot: {
    listName: string;
    totalCents: number;
    savingCents: number;
    referenceLabel: string;
    storeLabel: string;
    itemCount: number;
  },
) {
  const userId = await requireUserId();
  await assertOwns(userId, listId);
  await db.savingsRecord.create({ data: { userId, ...snapshot } });
  revalidatePath("/dashboard");
}

/* ─────────────── delen ─────────────── */

/** Maakt een deel-link. mode "read" = alleen bekijken, "copy" = kopieerbaar naar eigen lijsten. */
export async function createShare(listId: string, mode: "read" | "copy") {
  const userId = await requireUserId();
  await assertOwns(userId, listId);
  const token = crypto.randomUUID().replace(/-/g, "");
  await db.listShare.create({ data: { listId, token, mode } });
  revalidatePath(`/lijst/${listId}`);
  return token;
}

export async function revokeShares(listId: string) {
  const userId = await requireUserId();
  await assertOwns(userId, listId);
  await db.listShare.deleteMany({ where: { listId } });
  revalidatePath(`/lijst/${listId}`);
}

/** Kopieert een gedeelde (mode "copy") lijst naar de lijsten van de ingelogde gebruiker. */
export async function copySharedList(token: string) {
  const userId = await requireUserId();
  const share = await db.listShare.findUnique({
    where: { token },
    include: { list: { include: { items: true } } },
  });
  if (!share || share.mode !== "copy") throw new Error("NOT_FOUND");
  if (share.expiresAt && share.expiresAt < new Date()) throw new Error("EXPIRED");

  const copy = await db.shoppingList.create({
    data: { ownerId: userId, name: `${share.list.name} (gedeeld)` },
  });
  if (share.list.items.length) {
    await db.shoppingListItem.createMany({
      data: share.list.items.map((i) => ({
        listId: copy.id,
        rawText: i.rawText,
        canonicalProductId: i.canonicalProductId,
        categoryId: i.categoryId,
        quantity: i.quantity,
        unit: i.unit,
        brandMode: i.brandMode,
        pinnedBrandId: i.pinnedBrandId,
        position: i.position,
      })),
    });
  }
  revalidatePath("/lijsten");
  redirect(`/lijst/${copy.id}`);
}
