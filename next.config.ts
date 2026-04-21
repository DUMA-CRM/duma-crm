import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Bundle this package through Next.js instead of treating it as an external.
  // Needed because the package's exports map lists index.mjs but only ships index.js.
  transpilePackages: ['@duma-crm/api-client'],
};

export default nextConfig;
