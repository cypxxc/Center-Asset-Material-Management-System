import { NextRequest, NextResponse } from 'next/server'
import { authenticateSSOToken } from '@/features/auth/sso'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PORTAL = 'http://127.0.0.1:3001'

function localEnabled() {
  return process.env.NODE_ENV !== 'production' &&
    process.env.SSO_LOCAL_TEST_ENABLED === 'true' &&
    process.env.SSO_ENABLED === 'true' &&
    process.env.SSO_JWT_ISSUER === 'camms-local-test' &&
    process.env.SSO_JWT_AUDIENCE === 'camms-local'
}

export async function GET(request: NextRequest) {
  if (!localEnabled()) return new NextResponse('Not found', { status: 404 })
  const code = request.nextUrl.searchParams.get('code')
  if (!code || !/^[a-f0-9]{64}$/.test(code)) {
    return NextResponse.redirect(new URL('/login?error=sso_invalid_code', request.url))
  }

  try {
    const response = await fetch(PORTAL + '/exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-secret': process.env.SSO_LOCAL_TEST_CLIENT_SECRET ?? '',
      },
      body: JSON.stringify({ code }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('Exchange rejected')
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || !('token' in payload) ||
        typeof payload.token !== 'string' || payload.token.length > 8192) {
      throw new Error('Invalid exchange response')
    }
    const result = await authenticateSSOToken(payload.token)
    if (!result.success) throw new Error(result.code)
    const redirect = NextResponse.redirect(new URL('/dashboard', request.url))
    redirect.headers.set('Cache-Control', 'no-store')
    return redirect
  } catch {
    const redirect = NextResponse.redirect(new URL('/login?error=sso_failed', request.url))
    redirect.headers.set('Cache-Control', 'no-store')
    return redirect
  }
}
