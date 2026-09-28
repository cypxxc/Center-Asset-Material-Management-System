import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  compress: true,
  output: 'standalone',
  experimental: {
    // 10 MB covers normal form submissions and JSON payloads.
    // Presigned storage URLs should be used for massive data uploads.
    proxyClientMaxBodySize: '10mb',
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
