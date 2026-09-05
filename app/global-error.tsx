"use client";

// Vangt fouten die de root layout zelf breken (die geeft normaal gesproken geen
// error boundary). Meldt ze bij Sentry (no-op zonder DSN) en toont een simpele pagina.

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="nl">
      <body style={{ background: "#17202B", color: "#F6F1E6", fontFamily: "sans-serif" }}>
        <div style={{ maxWidth: 480, margin: "15vh auto", padding: "0 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 300 }}>Er ging iets mis.</h1>
          <p style={{ marginTop: 8, opacity: 0.7, fontSize: "0.9rem" }}>
            De fout is gemeld. Probeer de pagina te verversen.
          </p>
        </div>
      </body>
    </html>
  );
}
