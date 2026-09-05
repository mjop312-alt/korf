import { db } from "@/lib/db";

export interface NotifySettings {
  priceAlerts: boolean;
  weeklySummary: boolean;
  favouriteOffers: boolean;
}
const NOTIFY_DEFAULT: NotifySettings = { priceAlerts: true, weeklySummary: true, favouriteOffers: true };

export type Preference = Awaited<ReturnType<typeof getPreference>>;

export async function getPreference(userId: string) {
  const p =
    (await db.userPreference.findUnique({ where: { userId } })) ??
    (await db.userPreference.create({ data: { userId } }));

  const selectedStoreIds = Array.isArray(p.selectedStoreIds) ? (p.selectedStoreIds as string[]) : [];
  const notify = { ...NOTIFY_DEFAULT, ...((p.notify as Partial<NotifySettings> | null) ?? {}) };

  return { ...p, selectedStoreIds, notify };
}

/** De winkelselectie die als standaard geldt bij vergelijken (leeg ⇒ alle). */
export async function defaultStoreIds(userId: string | null, allIds: string[]): Promise<string[]> {
  if (!userId) return allIds;
  const p = await getPreference(userId);
  const valid = p.selectedStoreIds.filter((s) => allIds.includes(s));
  return valid.length ? valid : allIds;
}
