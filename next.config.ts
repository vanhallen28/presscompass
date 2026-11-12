import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cached, tag-revalidated public pages (Plan 4) build on Cache Components.
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Pin the root to this folder: a stray package-lock.json higher up (for example in the home
  // folder) otherwise makes Next.js print a root warning on every start.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
