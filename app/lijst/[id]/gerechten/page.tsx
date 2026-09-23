import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { addIngredientToList } from "@/lib/list-actions";
import { getListWithItems, getUserId } from "@/lib/lists";
import { matchRecipes } from "@/lib/recipes";

export const dynamic = "force-dynamic";

export default async function GerechtenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) redirect(`/inloggen?callbackUrl=/lijst/${id}/gerechten`);

  const list = await getListWithItems(userId, id);
  if (!list) notFound();

  const names = list.items.filter((i) => i.canonicalProduct).map((i) => i.canonicalProduct!.name);
  const matches = matchRecipes(names);

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <main id="main-content" className="mx-auto max-w-3xl px-5 py-10">
        <Link href={`/lijst/${id}`} className="font-mono text-xs text-muted hover:text-ink">
          ← {list.name}
        </Link>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-muted">Gerechten</p>
        <h1 className="mt-1 font-display text-3xl font-light text-ink">Wat kun je hiermee maken?</h1>
        <p className="mt-2 text-sm text-muted">
          Op basis van de {names.length} {names.length === 1 ? "product" : "producten"} op &ldquo;{list.name}&rdquo;. Geen AI —
          een vaste lijst bekende gerechten, vergeleken met de namen op je lijst.
        </p>

        {matches.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-line bg-raised p-8 text-center text-sm text-muted">
            Nog geen gerecht dat goed genoeg overeenkomt met deze lijst. Voeg een paar producten toe en kom terug.
          </p>
        ) : (
          <ul className="mt-8 space-y-4">
            {matches.map((m) => (
              <li key={m.recipe.slug} className="rounded-2xl border border-line bg-raised p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-display text-xl text-ink">
                    <span aria-hidden>{m.recipe.emoji}</span> {m.recipe.name}
                  </h2>
                  <span className="shrink-0 font-mono text-xs text-muted">
                    {m.have.length}/{m.recipe.ingredients.length} in huis
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.have.map((label) => (
                    <span key={label} className="rounded-full border border-sage bg-sage-wash px-2.5 py-0.5 text-xs text-sage">
                      ✓ {label}
                    </span>
                  ))}
                  {m.missing.map((i) => (
                    <form key={i.label} action={addIngredientToList.bind(null, id, i.words[0])}>
                      <button className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:border-brass-line hover:text-ink">
                        + {i.label}
                      </button>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
