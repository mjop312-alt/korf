import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// withSentryConfig is zelf ook een no-op qua gedrag zonder SENTRY_AUTH_TOKEN (alleen
// dan uploadt hij source maps bij de build) — veilig om altijd aan te laten staan.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
