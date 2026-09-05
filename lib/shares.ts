// Lees-kant van gedeelde lijsten (publieke /gedeeld/[token]-pagina).

import { db } from "@/lib/db";

export async function getShareByToken(token: string) {
  const share = await db.listShare.findUnique({
    where: { token },
    include: {
      list: {
        include: {
          owner: { select: { name: true } },
          items: {
            orderBy: { position: "asc" },
            include: { canonicalProduct: true, pinnedBrand: true },
          },
        },
      },
    },
  });
  if (!share) return null;
  if (share.expiresAt && share.expiresAt < new Date()) return null;
  return share;
}
