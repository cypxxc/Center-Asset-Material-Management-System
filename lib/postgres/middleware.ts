import { NextResponse, type NextRequest } from 'next/server'
import { profileForToken, SESSION_COOKIE } from './session'

export async function updatePostgresSession(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (path.startsWith('/api/') || path.startsWith('/_next/') || path === '/favicon.ico' || /^\/(assets|fonts|icons|images)\//.test(path)) return NextResponse.next({ request })
  try {
    const profile = await profileForToken(request.cookies.get(SESSION_COOKIE)?.value)
    if (!profile && path !== '/login') return NextResponse.redirect(new URL('/login',request.url))
    if (profile && path === '/login') return NextResponse.redirect(new URL('/dashboard',request.url))
    const response = NextResponse.next({ request })
    response.headers.set('Cache-Control','private, no-store')
    return response
  } catch {
    return new NextResponse('ไม่สามารถเชื่อมต่อฐานข้อมูลในเครื่องได้ กรุณาตรวจสอบ Docker Desktop', { status:503, headers:{ 'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store' } })
  }
}
