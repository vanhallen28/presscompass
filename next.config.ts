import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cached, tag-revalidated public pages (Plan 4) build on Cache Components.
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
};

export default nextConfig;
