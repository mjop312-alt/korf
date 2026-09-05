"use client";

import Link from "next/link";
import { useTransition } from "react";
import { formatEuro } from "@/lib/compare";
import { removePriceAlert, setPriceAlert } from "@/lib/alert-actions";

export function PriceAlertControl({
  slug,
  loggedIn,
  currentThresholdCents,
  suggestCents,
}: {
  slug: string;
  loggedIn: boolean;
  currentThresholdCents: number | null;
  suggestCents: number;
}) {
  const [pending, start] = useTransition();

  if (!loggedIn) {
    return (
      <p className="rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">
        <Link href={`/inloggen?callbackUrl=/product/${slug}`} className="text-brass underline underline-offset-2">
          Log in
        </Link>{" "}
        om een prijsalert in te stellen.
      </p>
    );
  }

  if (currentThresholdCents != null) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brass bg-brass-wash px-4 py-3 text-sm">
        <span className="text-text">
          Je krijgt bericht als de prijs onder <strong>{formatEuro(currentThresholdCents)}</strong> komt.
        </span>
        <button
          onClick={() => start(() => removePriceAlert(slug))}
          disabled={pending}
          className="font-mono text-xs text-clay hover:underline"
        >
          verwijder alert
        </button>
      </div>
    );
  }

  return (
    <form
      action={(fd) => start(() => setPriceAlert(slug, fd))}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-raised px-4 py-3"
    >
      <label className="text-sm">
        <span className="block font-mono text-[0.62rem] uppercase tracking-wider text-muted">
          Waarschuw me onder
        </span>
        <span className="mt-1 flex items-center gap-1">
          <span className="text-muted">€</span>
          <input
            name="threshold"
            type="text"
            inputMode="decimal"
            defaultValue={(suggestCents / 100).toFixed(2).replace(".", ",")}
            className="w-24 rounded-lg border border-line bg-ground px-2 py-1.5 font-mono text-ink outline-none focus-visible:ring-2 focus-visible:ring-brass"
          />
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-ground disabled:opacity-60"
      >
        Stel alert in
      </button>
    </form>
  );
}
