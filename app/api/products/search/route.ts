// GET /api/products/search?q=&store=&category=&brand=&kind=a|own&promo=1&minStores=2&sort=price&page=1
//
// Zoekt in de volledige catalogus. Geeft productgroepen terug (met per winkel de goedkoopste
// prijs) en, bij `variants=1`, ook de groepen met al hun varianten — dat heeft de lijstbouwer
// nodig om merkkeuzes te tonen en door te rekenen.

import { NextResponse } from "next/server";
import { searchGroups } from "@/lib/catalog-search";
import { loadGroups } from "@/lib/catalog-db";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const rate = checkRateLimit(`search:${getClientIp(request)}`, 120, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Te veel zoekopdrachten. Probeer het zo opnieuw." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const p = new URL(request.url).searchParams;
  const kind = p.get("kind");
  const sort = p.get("sort");

  const result = await searchGroups(db, {
    q: p.get("q")?.slice(0, 80) || undefined,
    store: p.get("store") || undefined,
    category: p.get("category") || undefined,
    brand: p.get("brand") || undefined,
    kind: kind === "a" || kind === "own" ? kind : undefined,
    promo: p.get("promo") === "1",
    minStores: p.get("minStores") ? parseInt(p.get("minStores")!, 10) || 1 : undefined,
    sort: sort === "price" || sort === "stores" ? sort : "relevance",
    page: p.get("page") ? parseInt(p.get("page")!, 10) || 1 : undefined,
    pageSize: p.get("limit") ? parseInt(p.get("limit")!, 10) || 24 : undefined,
  });

  const products = p.get("variants") === "1" ? await loadGroups(result.cards.map((c) => c.slug)) : undefined;
  return NextResponse.json({ ...result, products }, { headers: { "Cache-Control": "no-store" } });
}
