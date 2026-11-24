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
        source: '/connect/chatgpt/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
      {
        source: '/sign-in',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
      {
        // The guest QR page, and only it, may be framed — by this app alone — so
        // QR ordering settings can show the real page in its phone preview. Later
        // matches override earlier ones for the same key.
        source: '/order/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      {
        source: '/api/marketplace-frame/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(), clipboard-write=()' },
        ],
      },
      {
        // A hosted form is meant to be framed into any website. X-Frame-Options
        // can't say "anyone", so this value is deliberately not one browsers
        // recognise (they ignore it) and proxy.ts's `frame-ancestors *` rules.
        source: '/f/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'ALLOWALL' }],
      },
    ];
  },
  // Old addresses of screens that moved, kept for bookmarks and help links.
  // Resolved here rather than by a page so nothing renders on the way.
  async redirects() {
    return [
      // Overview has its own path so the sidebar marks only it as current.
      { source: '/admin', destination: '/admin/overview', permanent: false },
      { source: '/inventory/purchasing', destination: '/inventory?tab=demand', permanent: true },
      { source: '/inventory/restock-requests', destination: '/inventory?tab=demand', permanent: true },
      { source: '/inventory/stocktakes', destination: '/inventory?tab=stocktakes', permanent: true },
      { source: '/menu/modifiers/new', destination: '/menu/modifiers?new=1', permanent: true },
      { source: '/staff/shifts', destination: '/staff/rota', permanent: true },
      { source: '/settings/advanced', destination: '/settings', permanent: true },
      // Each screen's settings moved onto the screen itself, where it is their preview.
      { source: '/settings/configuration/dashboard', destination: '/dashboard?edit=1', permanent: true },
      { source: '/settings/configuration/kitchen', destination: '/kds?edit=1', permanent: true },
      { source: '/settings/configuration/orders', destination: '/orders?edit=1', permanent: true },
      { source: '/settings/configuration/pos', destination: '/pos?edit=1', permanent: true },
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
    // AVIF first: roughly a fifth smaller than WebP for screenshots, which is
    // most of the marketing site's weight and its LCP.
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mdm-assets.integration.costacoffee.com',
      },
      {
        protocol: 'https',
        hostname: 'duma-coffee.vercel.app',
      },
      // Blog covers from DUMA's own CMS (lib/blog/posts.ts), and a local API when DUMA_CMS_API_URL points at one.
      { protocol: 'https', hostname: 'api.duma-business.com', pathname: '/v1/cms/delivery/assets/**' },
      // Media storage (Vercel Blob), where Content asset delivery redirects — mirrors CSP_IMAGE_HOSTS.
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'http', hostname: 'localhost', port: '7777', pathname: '/v1/cms/delivery/assets/**' },
    ],
  },
};

export default nextConfig;
