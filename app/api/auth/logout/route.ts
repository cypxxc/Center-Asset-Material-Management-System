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

export async function POST() {
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
  try {
    await deleteSession()
  } catch (error) {
    return logoutFailure(error)
  }

  // Preserve the browser's IP/port, even when standalone resolves request.url
  // against its bind address (0.0.0.0) behind a proxy.
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: '/login?reason=idle_timeout' },
  })
  response.cookies.delete(SESSION_COOKIE)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}
