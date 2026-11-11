import { type NextRequest } from 'next/server'
import { applySecurityHeaders } from '@/lib/security-headers'
import { ensureTraceHeaders } from '@/lib/tracing'
import { updatePostgresSession } from '@/lib/postgres/middleware'

export async function proxy(request: NextRequest) {
  ensureTraceHeaders(request.headers)

  const response = await updatePostgresSession(request)

  return applySecurityHeaders(request, response)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     *
     * Explicit public asset directories are intentionally matched here and
     * allowed by PostgreSQL session middleware's narrow static-asset allowlist.
     */
    '/((?!_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$).*)',
  ],
}
