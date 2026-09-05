import { db } from "@/lib/db";
import { getUserId } from "@/lib/lists";

export async function getMyAlert(slug: string) {
  const userId = await getUserId();
  if (!userId) return null;
  const cp = await db.canonicalProduct.findUnique({ where: { slug }, select: { id: true } });
  if (!cp) return null;
  return db.priceAlert.findFirst({ where: { userId, canonicalProductId: cp.id } });
}

export async function getMyAlerts() {
  const userId = await getUserId();
  if (!userId) return [];
  return db.priceAlert.findMany({
    where: { userId },
    include: { canonicalProduct: { select: { slug: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}
