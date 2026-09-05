"use client";

import { useState, useTransition } from "react";
import { createShare } from "@/lib/list-actions";

export function ShareListDialog({ listId }: { listId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"read" | "copy">("copy");
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const generate = () =>
    start(async () => {
      const token = await createShare(listId, mode);
      setUrl(`${window.location.origin}/gedeeld/${token}`);
      setCopied(false);
    });

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          setUrl(null);
        }}
        className="rounded-xl border border-line px-3 py-2 text-sm text-ink hover:bg-ground"
      >
        Deel
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-line bg-raised p-4 shadow-xl">
          {!url ? (
            <>
              <p className="font-mono text-[0.62rem] uppercase tracking-wider text-muted">Hoe delen?</p>
              <div className="mt-2 space-y-1.5 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="mode" checked={mode === "copy"} onChange={() => setMode("copy")} />
                  <span className="text-ink">Kopieerbaar — ontvanger krijgt zijn eigen kopie</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="mode" checked={mode === "read"} onChange={() => setMode("read")} />
                  <span className="text-ink">Alleen bekijken</span>
                </label>
              </div>
              <button
                onClick={generate}
                disabled={pending}
                className="mt-3 w-full rounded-xl bg-ink px-4 py-2 text-sm font-medium text-ground disabled:opacity-60"
              >
                {pending ? "Bezig…" : "Maak link"}
              </button>
            </>
          ) : (
            <>
              <p className="font-mono text-[0.62rem] uppercase tracking-wider text-muted">Deel deze link</p>
              <div className="mt-2 break-all rounded-lg border border-line bg-ground px-3 py-2 font-mono text-xs text-ink">
                {url}
              </div>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="mt-2 w-full rounded-xl border border-line px-4 py-2 text-sm text-ink hover:bg-ground"
              >
                {copied ? "Gekopieerd ✓" : "Kopieer link"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
