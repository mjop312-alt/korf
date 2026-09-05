// Sentry-init voor de Edge-runtime (middleware.ts). Zie sentry.server.config.ts.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
