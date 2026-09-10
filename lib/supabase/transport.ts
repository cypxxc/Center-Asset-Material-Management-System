import { metrics } from '@/lib/metrics'
import { getRequestContext } from '@/lib/tracing/context'
import { logger } from '@/lib/logging'

function serviceFor(input: RequestInfo | URL): string {
  const pathname = new URL(input instanceof Request ? input.url : String(input)).pathname
  if (pathname.startsWith('/auth/v1/user')) return 'auth.user'
  if (pathname.startsWith('/auth/v1/token')) return 'auth.token'
  if (pathname.startsWith('/auth/v1/.well-known/')) return 'auth.jwks'
  if (pathname.startsWith('/auth/')) return 'auth.other'
  if (pathname.startsWith('/rest/v1/rpc/')) return 'rpc'
  if (pathname.startsWith('/rest/')) return 'rest'
  if (pathname.startsWith('/storage/')) return 'storage'
  return 'other'
}

/** Measures HTTP response-header latency, not PostgreSQL execution time/body parsing. */
export function instrumentSupabaseFetch(fetcher: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  return async (input, init) => {
    const service = serviceFor(input)
    const trace = process.env.CAMMS_PERF_TRACE === 'true' ? await getRequestContext() : null
    const start = performance.now()
    let status = 'network_error'
    try {
      const response = await fetcher(input, init)
      status = String(response.status)
      return response
    } finally {
      // Fixed-cardinality labels: never include credentials, URLs, filters, or user IDs.
      const latency = performance.now() - start
      metrics.counter('supabase.http.requests', 1, { service, status })
      metrics.timer('supabase.http.latency', latency, { service, status })
      if (trace) logger.info({ operation: 'supabase.http', feature: 'performance', requestId: trace.requestId, latency, status, details: { service } })
    }
  }
}
