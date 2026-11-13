import { NextResponse, type NextRequest } from 'next/server'
import { profileForToken, SESSION_COOKIE } from './session'

const PUBLIC_ITEM_PATTERN = /^\/items\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i
const STATIC_ASSET_PATTERN = /^\/(?:favicon\.ico|manifest\.webmanifest|robots\.txt|icon\.png|apple-icon\.png|\.well-known\/|(?:assets|fonts|icons|images)\/)/

export async function updatePostgresSession(request: NextRequest) {
  const path = request.nextUrl.pathname
  request.headers.set('x-pathname', path)
  if (path.startsWith('/api/') || path.startsWith('/_next/') || STATIC_ASSET_PATTERN.test(path)) return NextResponse.next({ request })
  try {
    const rawToken = request.cookies.get(SESSION_COOKIE)?.value
    const isIdleOrExplicitLogout = path === '/login' && (
      request.nextUrl.searchParams.get('reason') === 'idle_timeout' ||
      request.nextUrl.searchParams.get('logout') === 'true'
    )

    if (isIdleOrExplicitLogout) {
      if (rawToken && /^[a-f0-9]{64}$/.test(rawToken)) {
        try {
          const { getAuthDatabase } = await import('./db')
          const { tokenHash } = await import('./session')
          const { sql } = await import('drizzle-orm')
          await getAuthDatabase().execute(sql`delete from private_auth.sessions where token_hash=${tokenHash(rawToken)}`)
        } catch {
          // best-effort cleanup in middleware
        }
      }
      const response = NextResponse.next({ request: { headers: request.headers } })
      response.cookies.delete(SESSION_COOKIE)
      response.headers.set('Cache-Control', 'private, no-store')
      return response
    }

    const profile = await profileForToken(rawToken)
    if (!profile && PUBLIC_ITEM_PATTERN.test(path)) {
      const response = NextResponse.next({ request: { headers: request.headers } })
      response.headers.set('Cache-Control', 'private, no-store')
      return response
    }
    if (!profile && path !== '/login') return NextResponse.redirect(new URL('/login',request.url))
    if (profile && path === '/login') return NextResponse.redirect(new URL('/dashboard',request.url))
    const response = NextResponse.next({ request: { headers: request.headers } })
    response.headers.set('Cache-Control','private, no-store')
    return response
  } catch {
    return new NextResponse('ไม่สามารถเชื่อมต่อฐานข้อมูลในเครื่องได้ กรุณาตรวจสอบ Docker Desktop', { status:503, headers:{ 'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store' } })
  }
}
