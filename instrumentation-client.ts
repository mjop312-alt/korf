// Sentry-init voor de browser. NEXT_PUBLIC_-prefix nodig zodat de DSN meekomt in de
// client-bundle (een Sentry DSN is niet geheim — 'm publiek maken is de bedoeling).
// Zonder DSN is dit een no-op.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
