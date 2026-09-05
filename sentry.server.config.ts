// Sentry-init voor de Node-runtime (server components, route handlers, server actions).
// Geladen via instrumentation.ts. Zonder SENTRY_DSN is dit een no-op — Sentry's SDK
// schakelt zichzelf netjes uit als `dsn` leeg is, dus lokale dev zonder Sentry-account
// werkt gewoon door.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  // demodata/persoonlijk project — geen productiegeheimen om per ongeluk te loggen,
  // maar toch bewust laag gehouden i.p.v. 1.0
});
