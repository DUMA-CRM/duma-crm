import type { NextConfig } from 'next';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7777';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // proxy.ts runs on /be as well, and Next buffers only this much of a request
    // body there — silently truncating anything larger before the rewrite sends
    // it on. The default 10 MB broke Media uploads between 10 and 25 MB. Matches
    // the API's CMS upload limit (cmsUploadBodyLimit in duma-api src/app.ts).
    proxyClientMaxBodySize: '26mb',
  },
  // Baseline security headers. The CSP is not here: it needs a per-request
  // nonce, so it is set in proxy.ts where one can be generated.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
      {
        // The guest QR page, and only it, may be framed — by this app alone — so
        // QR ordering settings can show the real page in its phone preview. Later
        // matches override earlier ones for the same key.
        source: '/order/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
    ];
  },
  // Same-origin proxy for browser API calls. Lets the API's Set-Cookie land on
  // OUR origin so the session cookie is readable by the app (see lib/api/client.ts).
  async rewrites() {
    return [
      { source: '/be/:path*', destination: `${API_ORIGIN}/:path*` },
      // Product analytics, same-origin for the same reasons (lib/analytics/client.ts).
      { source: '/ingest/:path*', destination: `${POSTHOG_HOST}/:path*` },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mdm-assets.integration.costacoffee.com',
      },
      {
        protocol: 'https',
        hostname: 'duma-coffee.vercel.app',
      },
    ],
  },
};

export default nextConfig;
