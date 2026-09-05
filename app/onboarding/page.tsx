import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-chrome";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/lists";
import { getPreference } from "@/lib/preferences";
import { completeOnboarding } from "@/lib/preference-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Even instellen — Korf" };

export default async function OnboardingPage() {
  const userId = await getUserId();
  if (!userId) redirect("/inloggen?callbackUrl=/onboarding");

  const [pref, stores] = await Promise.all([
    getPreference(userId),
    db.supermarket.findMany({
      orderBy: { name: "asc" },
      include: { locations: { take: 1, select: { city: true } } },
    }),
  ]);

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">Even instellen</p>
        <h1 className="mt-3 font-display text-3xl font-light text-ink">Welke winkels doen mee?</h1>
        <p className="mt-2 text-sm text-muted">
          Vul je postcode in en kies de supermarkten in je buurt. Je kunt dit later aanpassen — of nu overslaan.
        </p>

        <form action={completeOnboarding} className="mt-8 space-y-6">
          <label className="block">
            <span className="font-mono text-[0.62rem] uppercase tracking-wider text-muted">Postcode</span>
            <input
              name="postcode"
              defaultValue={pref.postcode ?? ""}
              placeholder="1012 AB"
              className="mt-1 w-full rounded-xl border border-line bg-raised px-4 py-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brass"
            />
          </label>

          <label className="block">
            <span className="font-mono text-[0.62rem] uppercase tracking-wider text-muted">Maximale reisafstand</span>
            <select
              name="radiusKm"
              defaultValue={pref.radiusKm}
              className="mt-1 block rounded-xl border border-line bg-raised px-4 py-3 text-ink"
            >
              <option value={2}>2 km</option>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
            </select>
          </label>

          <fieldset className="space-y-2">
            <legend className="font-mono text-[0.62rem] uppercase tracking-wider text-muted">Winkels in de buurt</legend>
            {stores.map((s) => (
              <label key={s.slug} className="flex items-center gap-3 rounded-xl border border-line bg-raised px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  name="store"
                  value={s.slug}
                  defaultChecked={pref.selectedStoreIds.length === 0 || pref.selectedStoreIds.includes(s.slug)}
                  className="h-4 w-4 accent-[var(--color-brass)]"
                />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.brandColor }} />
                <span className="text-ink">{s.name}</span>
                <span className="ml-auto font-mono text-xs text-muted">{s.locations[0]?.city ?? "landelijk"}</span>
              </label>
            ))}
            <p className="text-xs text-muted">
              Assortiment, prijs en bezorging kunnen per locatie verschillen.
            </p>
          </fieldset>

          <div className="flex items-center gap-4">
            <button className="rounded-xl bg-ink px-6 py-3 font-medium text-ground">Klaar</button>
            <Link href="/dashboard" className="text-sm text-muted hover:text-ink">Overslaan</Link>
          </div>
        </form>
      </main>
    </div>
  );
}
