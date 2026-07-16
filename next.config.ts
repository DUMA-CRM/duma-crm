import type { NextConfig } from 'next';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7777';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Bundle this package through Next.js instead of treating it as an external.
  // Needed because the package's exports map lists index.mjs but only ships index.js.
  transpilePackages: ['@duma-crm/api-client'],
  // Baseline security headers. (No CSP yet — adding one requires auditing every
  // inline style/script Next emits; do it as a follow-up with report-only first.)
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
    ];
  },
  // Same-origin proxy for browser API calls. Lets the API's Set-Cookie land on
  // OUR origin so the session cookie is readable by the app (see lib/api/client.ts).
  async rewrites() {
    return [{ source: '/be/:path*', destination: `${API_ORIGIN}/:path*` }];
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
