import Link from "next/link";
import { SiteHeader } from "@/components/site-chrome";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">404</p>
        <h1 className="mt-3 font-display text-3xl font-light text-ink">Deze pagina bestaat niet</h1>
        <p className="mt-2 text-sm text-muted">Misschien is de link verouderd of het product verdwenen uit het assortiment.</p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-ground">
          Terug naar start
        </Link>
      </main>
    </div>
  );
}
