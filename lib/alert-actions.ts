"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/lists";

export async function setPriceAlert(slug: string, formData: FormData) {
  const userId = await requireUserId();
  const euros = parseFloat(String(formData.get("threshold") ?? "").replace(",", "."));
  if (!Number.isFinite(euros) || euros <= 0) return;
  const thresholdCents = Math.round(euros * 100);

  const cp = await db.canonicalProduct.findUnique({ where: { slug }, select: { id: true } });
  if (!cp) return;

  const existing = await db.priceAlert.findFirst({
    where: { userId, canonicalProductId: cp.id },
  });
  if (existing) {
    await db.priceAlert.update({ where: { id: existing.id }, data: { thresholdCents } });
  } else {
    await db.priceAlert.create({ data: { userId, canonicalProductId: cp.id, thresholdCents } });
  }
  revalidatePath(`/product/${slug}`);
}

export async function removePriceAlert(slug: string) {
  const userId = await requireUserId();
  const cp = await db.canonicalProduct.findUnique({ where: { slug }, select: { id: true } });
  if (!cp) return;
  await db.priceAlert.deleteMany({ where: { userId, canonicalProductId: cp.id } });
  revalidatePath(`/product/${slug}`);
}
