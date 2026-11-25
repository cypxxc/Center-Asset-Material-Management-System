import { NextResponse } from 'next/server'
import { deleteSession, SESSION_COOKIE } from '@/lib/postgres/session'

function logoutFailure(error: unknown) {
  console.error('Error during logout:', error)
  const response = NextResponse.json({ success: false }, {
    status: 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
  response.cookies.delete(SESSION_COOKIE)
  return response
}

function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return false
  }
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const origin = request.headers.get('origin')
  if (origin) {
    try {
      return Boolean(host) && new URL(origin).host === host
    } catch {
      return false
    }
  }
  const referer = request.headers.get('referer')
  if (referer) {
    try {
      return Boolean(host) && new URL(referer).host === host
    } catch {
      return false
    }
  }
  return true
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, {
      status: 403,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  }

  try {
    await deleteSession()
  } catch (error) {
    return logoutFailure(error)
  }

  const response = NextResponse.json({ success: true })
  response.cookies.delete(SESSION_COOKIE)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, {
    status: 405,
    headers: {
      Allow: 'POST',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
