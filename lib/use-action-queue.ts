"use client";

import { useCallback, useRef } from "react";

/**
 * Voert server-acties na elkaar uit, nooit gelijktijdig.
 *
 * Server actions die je los (niet via <form action>) rechtstreeks aanroept —
 * bv. bij het snel na elkaar aanvinken van meerdere regels — kunnen elkaar
 * overschrijven als ze gelijktijdig in-flight zijn. Deze hook rijgt ze in de rij:
 * de volgende start pas als de vorige klaar is.
 */
export function useActionQueue() {
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  return useCallback((fn: () => Promise<unknown>) => {
    const run = () => fn().catch((err) => console.error("Actie mislukt:", err));
    queue.current = queue.current.then(run, run);
    return queue.current;
  }, []);
}
