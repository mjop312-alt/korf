"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { signOut } from "@/auth";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/lists";

const num = (v: FormDataEntryValue | null) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export async function updateLocation(formData: FormData) {
  const userId = await requireUserId();
  const postcode = String(formData.get("postcode") ?? "").trim().toUpperCase() || null;
  const radiusKm = [2, 5, 10].includes(Number(formData.get("radiusKm"))) ? Number(formData.get("radiusKm")) : 5;
  const fulfilment = formData.get("fulfilment") === "delivery" ? "delivery" : "pickup";
  const travel = num(formData.get("travelCostPerKm"));

  await db.userPreference.update({
    where: { userId },
    data: {
      postcode,
      radiusKm,
      fulfilment,
      travelCostPerKmCents: travel != null ? Math.round(travel * 100) : 0,
    },
  });
  revalidatePath("/instellingen");
  revalidatePath("/dashboard");
}

export async function updateStores(formData: FormData) {
  const userId = await requireUserId();
  const selected = formData.getAll("store").map(String);
  await db.userPreference.update({ where: { userId }, data: { selectedStoreIds: selected } });
  revalidatePath("/instellingen");
  revalidatePath("/vergelijk");
}

export async function updatePreferences(formData: FormData) {
  const userId = await requireUserId();
  const mode = String(formData.get("defaultBrandMode") ?? "any");
  const minExtra = num(formData.get("minExtraStoreSaving"));
  const budget = num(formData.get("budget"));
  await db.userPreference.update({
    where: { userId },
    data: {
      defaultBrandMode: ["any", "prefer_own", "always_a_brand"].includes(mode) ? mode : "any",
      minExtraStoreSavingCents: minExtra != null ? Math.round(minExtra * 100) : 200,
      budgetCents: budget != null && budget > 0 ? Math.round(budget * 100) : null,
    },
  });
  revalidatePath("/instellingen");
}

export async function updateNotify(formData: FormData) {
  const userId = await requireUserId();
  await db.userPreference.update({
    where: { userId },
    data: {
      notify: {
        priceAlerts: formData.get("priceAlerts") === "on",
        weeklySummary: formData.get("weeklySummary") === "on",
        favouriteOffers: formData.get("favouriteOffers") === "on",
      },
    },
  });
  revalidatePath("/instellingen");
}

/** Onboarding: postcode + straal + gekozen winkels in één keer. */
export async function completeOnboarding(formData: FormData) {
  const userId = await requireUserId();
  const postcode = String(formData.get("postcode") ?? "").trim().toUpperCase() || null;
  const radiusKm = [2, 5, 10].includes(Number(formData.get("radiusKm"))) ? Number(formData.get("radiusKm")) : 5;
  const stores = formData.getAll("store").map(String);
  await db.userPreference.update({
    where: { userId },
    data: { postcode, radiusKm, selectedStoreIds: stores.length ? stores : undefined },
  });
  redirect("/dashboard");
}

export async function changePassword(formData: FormData) {
  const userId = await requireUserId();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (next.length < 8) return;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash || !(await bcrypt.compare(current, user.passwordHash))) return;

  await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  revalidatePath("/instellingen");
}

export async function deleteAccount(formData: FormData) {
  const userId = await requireUserId();
  if (String(formData.get("confirm")).trim().toUpperCase() !== "VERWIJDER") return;
  await db.user.delete({ where: { id: userId } });
  await signOut({ redirectTo: "/" });
}
