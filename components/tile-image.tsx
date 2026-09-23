"use client";

import { useEffect, useRef, useState } from "react";

const RETRY_DELAY_MS = 600;

/**
 * Echte productfoto van de winkel, over de gegenereerde tegel heen. Winkel-CDN's haperen af en
 * toe op een enkel verzoek (geen echt kapotte link) — bij een mislukte download proberen we het
 * daarom één keer opnieuw (met een verse cache-buster) voordat de tegel eronder zichtbaar blijft.
 */
export function TileImage({ src, alt }: { src: string; alt: string }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const retried = useRef(false);

  // een andere src (ander product) is een schone start
  useEffect(() => {
    retried.current = false;
    setAttempt(0);
    setFailed(false);
  }, [src]);

  if (failed) return null;

  const url = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={url}
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (retried.current) {
          setFailed(true);
          return;
        }
        retried.current = true;
        setTimeout(() => setAttempt((a) => a + 1), RETRY_DELAY_MS);
      }}
      className="absolute inset-0 h-full w-full bg-white object-contain p-0.5"
    />
  );
}
