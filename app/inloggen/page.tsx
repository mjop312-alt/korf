"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { SiteHeader } from "@/components/site-chrome";

function InloggenForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(data.get("email")),
      password: String(data.get("password")),
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      setError("E-mailadres of wachtwoord klopt niet.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col px-6 py-16">
      <h1 className="font-display text-3xl font-light text-ink">Inloggen</h1>
      <p className="mt-2 text-sm text-muted">
        Nog geen account?{" "}
        <Link href="/registreren" className="text-brass underline underline-offset-2">Maak er een</Link> —
        dan bewaren we je lijsten en je besparing.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="font-mono text-xs uppercase tracking-wider text-muted">E-mail</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1.5 w-full rounded-xl border border-line bg-raised px-4 py-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brass"
          />
        </label>
        <label className="block">
          <span className="font-mono text-xs uppercase tracking-wider text-muted">Wachtwoord</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1.5 w-full rounded-xl border border-line bg-raised px-4 py-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brass"
          />
        </label>

        {error && <p className="rounded-lg bg-clay-wash px-3 py-2 text-sm text-clay">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-ink px-4 py-3 font-medium text-ground disabled:opacity-60"
        >
          {busy ? "Bezig…" : "Inloggen"}
        </button>
      </form>

      <p className="mt-6 rounded-xl border border-line bg-sunken px-4 py-3 font-mono text-xs text-muted">
        Demo-account: <span className="text-ink">demo@korf.nl</span> / <span className="text-ink">demo1234</span>
      </p>
    </main>
  );
}

export default function InloggenPage() {
  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <Suspense fallback={<div className="mx-auto max-w-sm px-6 py-16 text-sm text-muted">Laden…</div>}>
        <InloggenForm />
      </Suspense>
    </div>
  );
}
