import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";

export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Link href="/" className="font-display text-2xl font-light tracking-tight text-ink">
        k<span className="font-medium">or</span>f<span className="text-brass">.</span>
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        <Link href="/aanbiedingen" className="hidden text-muted hover:text-ink sm:inline">
          Aanbiedingen
        </Link>
        <Link href="/betrouwbaarheid" className="hidden text-muted hover:text-ink sm:inline">
          Betrouwbaarheid
        </Link>
        <Link href="/lijst" className="rounded-xl bg-ink px-4 py-2 font-medium text-ground">
          Maak een lijst
        </Link>
        <AccountMenu />
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-muted">
        <Link href="/hoe-het-werkt" className="hover:text-ink">Hoe het werkt</Link>
        <Link href="/betrouwbaarheid" className="hover:text-ink">Betrouwbaarheid</Link>
        <Link href="/over" className="hover:text-ink">Over Korf</Link>
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        <span className="ml-auto">Demo- en mockdata tenzij een echte databron is aangesloten.</span>
      </div>
    </footer>
  );
}
