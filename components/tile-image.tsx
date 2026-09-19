"use client";

import { useState } from "react";

/**
 * Echte productfoto van de winkel, over de gegenereerde tegel heen. Laadt de foto niet
 * (verlopen link, geblokkeerd), dan verdwijnt hij en blijft de tegel eronder zichtbaar.
 */
export function TileImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full bg-white object-contain p-0.5"
    />
  );
}
