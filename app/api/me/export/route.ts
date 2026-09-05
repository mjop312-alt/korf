import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/lists";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      createdAt: true,
      preference: true,
      lists: {
        include: { items: { include: { canonicalProduct: { select: { slug: true, name: true } } } } },
      },
      priceAlerts: { include: { canonicalProduct: { select: { slug: true } } } },
      favorites: { include: { canonicalProduct: { select: { slug: true, name: true } } } },
    },
  });

  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), user }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="korf-mijn-gegevens.json"',
    },
  });
}
