import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  compress: true,
  output: 'standalone',
  experimental: {
    proxyClientMaxBodySize: '52mb',
    serverActions: {
      // A 25 MiB JSON backup is itself encoded inside an action string. Escaping
      // can double its size; business validators still enforce the file limits.
      bodySizeLimit: '52mb',
    },
  },
}

export default nextConfig
