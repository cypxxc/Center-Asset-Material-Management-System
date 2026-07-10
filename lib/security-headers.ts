import { NextResponse, type NextRequest } from 'next/server'
import {
  ensureTraceHeaders,
  setTraceResponseHeaders,
} from '@/lib/tracing/headers'

export const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' blob: data: https://*.supabase.co https://images.unsplash.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src 'self' data: https://fonts.gstatic.com;",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const

export function applySecurityHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const ids = ensureTraceHeaders(request.headers)
  setTraceResponseHeaders(response.headers, ids)

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }

  return response
}
