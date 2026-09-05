import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/lists";
import { getPreference } from "@/lib/preferences";
import {
  changePassword,
  deleteAccount,
  updateLocation,
  updateNotify,
  updatePreferences,
  updateStores,
} from "@/lib/preference-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Instellingen — Korf" };

const TABS = [
  ["locatie", "Locatie"],
  ["winkels", "Winkels"],
  ["voorkeuren", "Voorkeuren"],
  ["meldingen", "Meldingen"],
  ["privacy", "Privacy"],
  ["account", "Account"],
] as const;

const field = "mt-1 w-full rounded-xl border border-line bg-ground px-3 py-2 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brass";
const labelCls = "block text-sm";
const cap = "font-mono text-[0.62rem] uppercase tracking-wider text-muted";
const saveBtn = "rounded-xl bg-ink px-5 py-2 text-sm font-medium text-ground";

export default async function InstellingenPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const userId = await getUserId();
  if (!userId) redirect("/inloggen?callbackUrl=/instellingen");

  const { tab: tabParam } = await searchParams;
  const tab = TABS.some(([k]) => k === tabParam) ? tabParam! : "locatie";

  const [pref, user, stores] = await Promise.all([
    getPreference(userId),
    db.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
    db.supermarket.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-3xl font-light text-ink">Instellingen</h1>

        <nav className="mt-6 flex flex-wrap gap-1.5">
          {TABS.map(([k, label]) => (
            <Link
              key={k}
              href={`/instellingen?tab=${k}`}
              className={`rounded-full border px-3 py-1 text-xs ${
                tab === k ? "border-brass bg-brass-wash text-ink" : "border-line text-muted hover:text-ink"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-8">
          {tab === "locatie" && (
            <form action={updateLocation} className="space-y-4 rounded-2xl border border-line bg-raised p-5">
              <label className={labelCls}>
                <span className={cap}>Postcode</span>
                <input name="postcode" defaultValue={pref.postcode ?? ""} placeholder="1012 AB" className={field} />
              </label>
              <label className={labelCls}>
                <span className={cap}>Maximale reisafstand</span>
                <select name="radiusKm" defaultValue={pref.radiusKm} className={field}>
                  <option value={2}>2 km</option>
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                </select>
              </label>
              <label className={labelCls}>
                <span className={cap}>Boodschappen</span>
                <select name="fulfilment" defaultValue={pref.fulfilment} className={field}>
                  <option value="pickup">Zelf ophalen</option>
                  <option value="delivery">Laten bezorgen</option>
                </select>
              </label>
              <label className={labelCls}>
                <span className={cap}>Geschatte reiskosten per km (€)</span>
                <input
                  name="travelCostPerKm"
                  defaultValue={(pref.travelCostPerKmCents / 100).toFixed(2).replace(".", ",")}
                  className={field}
                />
              </label>
              <button className={saveBtn}>Opslaan</button>
            </form>
          )}

          {tab === "winkels" && (
            <form action={updateStores} className="space-y-3 rounded-2xl border border-line bg-raised p-5">
              <p className="text-sm text-muted">
                Deze winkels doen standaard mee bij vergelijken. Per lijst pas je het aan.
              </p>
              {stores.map((s) => (
                <label key={s.slug} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="store"
                    value={s.slug}
                    defaultChecked={pref.selectedStoreIds.length === 0 || pref.selectedStoreIds.includes(s.slug)}
                    className="h-4 w-4 accent-[var(--color-brass)]"
                  />
                  <span className="h-2 w-2 rounded-full" style={{ background: s.brandColor }} />
                  <span className="text-ink">{s.name}</span>
                </label>
              ))}
              <button className={saveBtn}>Opslaan</button>
            </form>
          )}

          {tab === "voorkeuren" && (
            <form action={updatePreferences} className="space-y-4 rounded-2xl border border-line bg-raised p-5">
              <label className={labelCls}>
                <span className={cap}>Standaard merkkeuze voor nieuwe regels</span>
                <select name="defaultBrandMode" defaultValue={pref.defaultBrandMode} className={field}>
                  <option value="any">Maakt meestal niet uit</option>
                  <option value="prefer_own">Voorkeur huismerk</option>
                  <option value="always_a_brand">Altijd A-merk</option>
                </select>
              </label>
              <label className={labelCls}>
                <span className={cap}>Extra winkel pas de moeite waard vanaf (€)</span>
                <input
                  name="minExtraStoreSaving"
                  defaultValue={(pref.minExtraStoreSavingCents / 100).toFixed(2).replace(".", ",")}
                  className={field}
                />
              </label>
              <label className={labelCls}>
                <span className={cap}>Richtbudget per lijst (€, optioneel)</span>
                <input
                  name="budget"
                  defaultValue={pref.budgetCents ? (pref.budgetCents / 100).toFixed(2).replace(".", ",") : ""}
                  placeholder="—"
                  className={field}
                />
              </label>
              <button className={saveBtn}>Opslaan</button>
            </form>
          )}

          {tab === "meldingen" && (
            <form action={updateNotify} className="space-y-3 rounded-2xl border border-line bg-raised p-5">
              {(
                [
                  ["priceAlerts", "Prijsalerts — bericht als een product onder je drempel komt"],
                  ["weeklySummary", "Wekelijkse besparingssamenvatting"],
                  ["favouriteOffers", "Nieuwe aanbiedingen op je favorieten"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name={k}
                    defaultChecked={pref.notify[k]}
                    className="h-4 w-4 accent-[var(--color-brass)]"
                  />
                  <span className="text-ink">{label}</span>
                </label>
              ))}
              <p className="text-xs text-muted">Meldingen worden in deze demo niet echt verstuurd.</p>
              <button className={saveBtn}>Opslaan</button>
            </form>
          )}

          {tab === "privacy" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-raised p-5 text-sm">
                <h2 className="font-display text-lg text-ink">Je gegevens</h2>
                <p className="mt-2 text-muted">
                  Download alles wat Korf van je bewaart: je lijsten, voorkeuren en prijsalerts.
                </p>
                <a
                  href="/api/me/export"
                  className="mt-3 inline-block rounded-xl border border-line px-4 py-2 text-ink hover:bg-ground"
                >
                  Download mijn gegevens (JSON)
                </a>
              </div>
              <div className="rounded-2xl border border-clay/40 bg-clay-wash/40 p-5 text-sm">
                <h2 className="font-display text-lg text-ink">Account verwijderen</h2>
                <p className="mt-2 text-muted">
                  Dit verwijdert je account en alle lijsten definitief. Typ <strong>VERWIJDER</strong> om te bevestigen.
                </p>
                <form action={deleteAccount} className="mt-3 flex flex-wrap gap-2">
                  <input name="confirm" placeholder="VERWIJDER" className="rounded-xl border border-line bg-ground px-3 py-2 text-ink" />
                  <button className="rounded-xl border border-clay px-4 py-2 text-clay hover:bg-clay-wash">
                    Verwijder account
                  </button>
                </form>
              </div>
            </div>
          )}

          {tab === "account" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-raised p-5 text-sm">
                <p className={cap}>Naam</p>
                <p className="text-ink">{user?.name ?? "—"}</p>
                <p className={`${cap} mt-3`}>E-mail</p>
                <p className="text-ink">{user?.email}</p>
              </div>
              <form action={changePassword} className="space-y-3 rounded-2xl border border-line bg-raised p-5">
                <h2 className="font-display text-lg text-ink">Wachtwoord wijzigen</h2>
                <label className={labelCls}>
                  <span className={cap}>Huidig wachtwoord</span>
                  <input name="current" type="password" autoComplete="current-password" className={field} />
                </label>
                <label className={labelCls}>
                  <span className={cap}>Nieuw wachtwoord (min. 8 tekens)</span>
                  <input name="next" type="password" minLength={8} autoComplete="new-password" className={field} />
                </label>
                <button className={saveBtn}>Wijzig wachtwoord</button>
              </form>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
