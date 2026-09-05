"use client";

import { useState } from "react";

export function ReceiptCopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard geblokkeerd — stil negeren */
        }
      }}
      className="font-mono text-[0.62rem] uppercase tracking-wider text-brass hover:underline"
    >
      {done ? "gekopieerd ✓" : "kopieer bon"}
    </button>
  );
}
