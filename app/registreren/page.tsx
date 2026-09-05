"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { SiteHeader } from "@/components/site-chrome";

export default function RegistrerenPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    const payload = {
      name: String(data.get("name")),
      email: String(data.get("email")),
      password: String(data.get("password")),
    };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Er ging iets mis." }));
      setError(error);
      setBusy(false);
      return;
    }

    // meteen inloggen
    await signIn("credentials", { email: payload.email, password: payload.password, redirect: false });
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-ground text-text">
      <SiteHeader />
      <main id="main-content" className="mx-auto flex max-w-sm flex-col px-6 py-16">
        <h1 className="font-display text-3xl font-light text-ink">Account maken</h1>
        <p className="mt-2 text-sm text-muted">
          Bewaar je besparing.{" "}
          <Link href="/inloggen" className="text-brass underline underline-offset-2">Al een account?</Link>
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="font-mono text-xs uppercase tracking-wider text-muted">Naam</span>
            <input
              name="name"
              required
              autoComplete="name"
              className="mt-1.5 w-full rounded-xl border border-line bg-raised px-4 py-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brass"
            />
          </label>
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
              minLength={8}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-xl border border-line bg-raised px-4 py-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-brass"
            />
            <span className="mt-1 block text-xs text-muted">Minstens 8 tekens.</span>
          </label>

          {error && <p className="rounded-lg bg-clay-wash px-3 py-2 text-sm text-clay">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-ink px-4 py-3 font-medium text-ground disabled:opacity-60"
          >
            {busy ? "Bezig…" : "Account maken"}
          </button>
        </form>

        <p className="mt-4 text-xs text-muted">
          Met een account maken ga je akkoord met de{" "}
          <Link href="/voorwaarden" className="text-brass underline underline-offset-2">voorwaarden</Link>{" "}
          en de{" "}
          <Link href="/privacy" className="text-brass underline underline-offset-2">privacyverklaring</Link>.
        </p>
      </main>
    </div>
  );
}
