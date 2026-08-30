import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { applySecurityHeaders } from '@/lib/security-headers'
import { ensureTraceHeaders } from '@/lib/tracing'

export async function proxy(request: NextRequest) {
  ensureTraceHeaders(request.headers)

  const response = await updateSession(request)

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
     * allowed by updateSession's narrow static-asset allowlist.
     */
    '/((?!_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$).*)',
  ],
}
