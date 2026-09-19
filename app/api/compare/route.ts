// POST /api/compare
// body: { items: ListItem[], storeIds: StoreId[], maxStoresBalanced?, minExtraStoreSavingCents? }
//
// Leest de catalogus (met prijzen + collectedAt) uit de DATABASE, gecachet —
// nooit een live-call naar een supermarkt in dit request-pad.

import { NextResponse } from "next/server";
import { getCompareCatalog } from "@/lib/catalog-db";
import { compareList } from "@/lib/compare";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/lists";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { ListItem, StoreId } from "@/lib/types";

interface Body {
  items: ListItem[];
  storeIds: StoreId[];
  maxStoresBalanced?: number;
  minExtraStoreSavingCents?: number;
}

function validate(body: unknown): body is Body {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.items) || !Array.isArray(b.storeIds)) return false;
  const ids = new Set(b.items.map((it) => (it as ListItem | null)?.id));
  if (ids.size !== b.items.length) return false; // ids ontbreken of zijn dubbel
  return b.items.every(
    (it) =>
      it &&
      typeof it === "object" &&
      typeof (it as ListItem).id === "string" &&
      typeof (it as ListItem).productId === "string" &&
      typeof (it as ListItem).quantity === "number" &&
      (it as ListItem).quantity > 0,
  );
}

export async function POST(request: Request) {
  const rate = checkRateLimit(`compare:${getClientIp(request)}`, 60, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Te veel verzoeken. Probeer het over een paar seconden opnieuw." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }
  if (!validate(body)) {
    return NextResponse.json(
      { error: "Verwacht { items: [{ id (uniek), productId, quantity, brandMode }], storeIds: [] }" },
      { status: 422 },
    );
  }

  if (body.items.length > 100) {
    return NextResponse.json({ error: "Maximaal 100 regels per vergelijking" }, { status: 422 });
  }
  const { catalog, supermarkets, freshness } = await getCompareCatalog(body.items.map((it) => it.productId));

  // eigen voorkeur "extra winkel waard vanaf" toepassen als de gebruiker is ingelogd
  let minExtra = body.minExtraStoreSavingCents ?? 200;
  const userId = await getUserId();
  if (userId) {
    const pref = await db.userPreference.findUnique({
      where: { userId },
      select: { minExtraStoreSavingCents: true },
    });
    if (pref) minExtra = pref.minExtraStoreSavingCents;
  }

  const result = compareList(body.items, catalog, supermarkets, {
    storeIds: body.storeIds,
    maxStoresBalanced: body.maxStoresBalanced ?? 2,
    minExtraStoreSavingCents: minExtra,
  });

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      currency: "EUR",
      freshness,
      ...result,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
