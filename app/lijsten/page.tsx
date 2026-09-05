import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-chrome";
import {
  archiveList,
  createList,
  deleteList,
  duplicateList,
  setActiveList,
  unarchiveList,
} from "@/lib/list-actions";
import { LIST_TEMPLATES } from "@/lib/list-map";
import { getArchivedLists, getLists, getUserId } from "@/lib/lists";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(d);

export default async function ListsPage() {
  const userId = await getUserId();
  if (!userId) redirect("/inloggen?callbackUrl=/lijsten");

  const [lists, archived] = await Promise.all([getLists(userId), getArchivedLists(userId)]);

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-3xl font-light text-ink">Je lijsten</h1>

        {/* nieuwe lijst */}
        <form
          action={createList}
          className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-raised p-4"
        >
          <label className="flex-1">
            <span className="font-mono text-[0.62rem] uppercase tracking-wider text-muted">Nieuwe lijst</span>
            <input
              name="name"
              placeholder="Naam (optioneel)"
              className="mt-1 w-full rounded-xl border border-line bg-ground px-3 py-2 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brass"
            />
          </label>
          <label>
            <span className="font-mono text-[0.62rem] uppercase tracking-wider text-muted">Sjabloon</span>
            <select
              name="template"
              className="mt-1 block rounded-xl border border-line bg-ground px-3 py-2 text-ink"
            >
              <option value="">Leeg</option>
              {Object.entries(LIST_TEMPLATES).map(([key, t]) => (
                <option key={key} value={key}>{t.label}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-xl bg-ink px-5 py-2 font-medium text-ground">
            Maak lijst
          </button>
        </form>

        {/* actieve lijsten */}
        {lists.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-line bg-raised p-8 text-center text-sm text-muted">
            Nog geen lijsten. Maak er hierboven een — leeg of van een sjabloon.
          </p>
        ) : (
          <ul className="mt-8 space-y-3">
            {lists.map((l) => (
              <li
                key={l.id}
                className={`rounded-2xl border p-4 ${l.isActive ? "border-brass bg-brass-wash" : "border-line bg-raised"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/lijst/${l.id}`} className="font-display text-lg text-ink hover:underline">
                        {l.name}
                      </Link>
                      {l.isActive && (
                        <span className="rounded-full border border-brass px-2 py-0.5 font-mono text-[0.55rem] uppercase text-brass">
                          actief
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-muted">
                      {l._count.items} {l._count.items === 1 ? "product" : "producten"} · gewijzigd {fmtDate(l.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {!l.isActive && (
                      <form action={setActiveList.bind(null, l.id)}>
                        <button className="rounded-lg border border-line px-2.5 py-1 text-ink hover:bg-ground">
                          Als actief
                        </button>
                      </form>
                    )}
                    <form action={duplicateList.bind(null, l.id)}>
                      <button className="rounded-lg border border-line px-2.5 py-1 text-ink hover:bg-ground">
                        Dupliceer
                      </button>
                    </form>
                    <form action={archiveList.bind(null, l.id)}>
                      <button className="rounded-lg border border-line px-2.5 py-1 text-muted hover:border-clay hover:text-clay">
                        Archiveer
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* gearchiveerd */}
        {archived.length > 0 && (
          <section className="mt-12">
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted">Gearchiveerd</h2>
            <ul className="mt-3 space-y-2">
              {archived.map((l) => (
                <li key={l.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5 text-sm">
                  <span className="text-muted">
                    {l.name} · {l._count.items} producten
                  </span>
                  <span className="flex gap-1.5 text-xs">
                    <form action={unarchiveList.bind(null, l.id)}>
                      <button className="rounded-lg border border-line px-2.5 py-1 text-ink hover:bg-raised">Terugzetten</button>
                    </form>
                    <form action={deleteList.bind(null, l.id)}>
                      <button className="rounded-lg border border-line px-2.5 py-1 text-clay hover:bg-clay-wash">Verwijder</button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
