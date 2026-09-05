// Besparingsgeschiedenis — gebaseerd op SavingsRecord (één per afgeronde boodschappentrip,
// vastgelegd in "boodschappen doen" zodra alle regels zijn afgevinkt en weggehaald).

import { db } from "@/lib/db";

export interface MonthSaving {
  month: string; // "2026-09"
  label: string; // "sep '26"
  savingCents: number;
  totalCents: number;
  trips: number;
}

/** Besparing per maand, de laatste `months` maanden (ook lege maanden, voor een gelijkmatige reeks). */
export async function getSavingsHistory(userId: string, months = 6): Promise<MonthSaving[]> {
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  since.setMonth(since.getMonth() - (months - 1));

  const records = await db.savingsRecord.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { createdAt: true, savingCents: true, totalCents: true },
  });

  const byMonth = new Map<string, { savingCents: number; totalCents: number; trips: number }>();
  for (const r of records) {
    const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const cur = byMonth.get(key) ?? { savingCents: 0, totalCents: 0, trips: 0 };
    cur.savingCents += r.savingCents;
    cur.totalCents += r.totalCents;
    cur.trips += 1;
    byMonth.set(key, cur);
  }

  const out: MonthSaving[] = [];
  const cursor = new Date(since);
  for (let i = 0; i < months; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const agg = byMonth.get(key) ?? { savingCents: 0, totalCents: 0, trips: 0 };
    out.push({
      month: key,
      label: new Intl.DateTimeFormat("nl-NL", { month: "short", year: "2-digit" }).format(cursor),
      ...agg,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/** Totale besparing sinds het begin (voor een lifetime-stat op het dashboard). */
export async function getLifetimeSavings(userId: string) {
  const agg = await db.savingsRecord.aggregate({
    where: { userId },
    _sum: { savingCents: true },
    _count: true,
  });
  return { savingCents: agg._sum.savingCents ?? 0, trips: agg._count };
}
