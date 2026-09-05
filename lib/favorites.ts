"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/lists";

export async function isFavorite(slug: string) {
  const userId = await getUserId();
  if (!userId) return false;
  const cp = await db.canonicalProduct.findUnique({ where: { slug }, select: { id: true } });
  if (!cp) return false;
  return !!(await db.favoriteProduct.findUnique({
    where: { userId_canonicalProductId: { userId, canonicalProductId: cp.id } },
  }));
}

export async function toggleFavorite(slug: string) {
  const userId = await getUserId();
  if (!userId) return;
  const cp = await db.canonicalProduct.findUnique({ where: { slug }, select: { id: true } });
  if (!cp) return;
  const key = { userId_canonicalProductId: { userId, canonicalProductId: cp.id } };
  const existing = await db.favoriteProduct.findUnique({ where: key });
  if (existing) await db.favoriteProduct.delete({ where: key });
  else await db.favoriteProduct.create({ data: { userId, canonicalProductId: cp.id } });
  revalidatePath(`/product/${slug}`);
  revalidatePath("/dashboard");
}

export async function getFavorites() {
  const userId = await getUserId();
  if (!userId) return [];
  const rows = await db.favoriteProduct.findMany({
    where: { userId },
    include: { canonicalProduct: { select: { slug: true, name: true, category: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => r.canonicalProduct);
}
