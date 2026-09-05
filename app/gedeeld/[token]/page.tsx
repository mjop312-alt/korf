import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { copySharedList } from "@/lib/list-actions";
import { getUserId } from "@/lib/lists";
import { getShareByToken } from "@/lib/shares";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gedeelde lijst — Korf" };

const brandLabel = (mode: string, pinnedBrand?: string | null) =>
  mode === "any" ? "maakt niet uit" : mode === "own_brand" ? "alleen huismerk" : pinnedBrand ?? "vastgezet merk";

export default async function SharedListPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await getShareByToken(token);
  if (!share) notFound();

  const userId = await getUserId();

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">
          Gedeeld door {share.list.owner.name ?? "een Korf-gebruiker"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-light text-ink">{share.list.name}</h1>
        <p className="mt-2 text-sm text-muted">
          {share.mode === "copy"
            ? "Je kunt deze lijst kopiëren naar je eigen lijsten."
            : "Alleen-lezen — je kunt deze lijst bekijken maar niet aanpassen."}
        </p>

        <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-raised">
          {share.list.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <span className="text-ink">{i.canonicalProduct?.name ?? i.rawText}</span>
                <span className="ml-2 font-mono text-xs text-muted">×{i.quantity}</span>
              </div>
              <span className="font-mono text-xs text-muted">{brandLabel(i.brandMode, i.pinnedBrand?.name)}</span>
            </li>
          ))}
          {share.list.items.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted">Deze lijst is leeg.</li>
          )}
        </ul>

        <div className="mt-6 flex flex-wrap gap-3">
          {share.mode === "copy" &&
            (userId ? (
              <form action={copySharedList.bind(null, token)}>
                <button className="rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-ground">
                  Kopieer naar mijn lijsten
                </button>
              </form>
            ) : (
              <Link
                href={`/inloggen?callbackUrl=/gedeeld/${token}`}
                className="rounded-xl border border-line px-5 py-2.5 text-sm text-ink"
              >
                Log in om te kopiëren
              </Link>
            ))}
          <Link href="/" className="rounded-xl border border-line px-5 py-2.5 text-sm text-ink">
            Naar Korf
          </Link>
        </div>

        <p className="mt-8 text-xs text-muted">Demodata — geen actuele prijzen.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
