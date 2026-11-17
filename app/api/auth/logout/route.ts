import { NextResponse } from 'next/server'
import { deleteSession, SESSION_COOKIE } from '@/lib/postgres/session'

export async function POST() {
  try {
    await deleteSession()
  } catch (error) {
    console.error('Error during logout:', error)
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
    console.error('Error during logout:', error)
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
