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

export async function GET(request: Request) {
  try {
    await deleteSession()
  } catch (error) {
    console.error('Error during logout:', error)
  }

  const url = new URL('/login?reason=idle_timeout', request.url)
  const response = NextResponse.redirect(url)
  response.cookies.delete(SESSION_COOKIE)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}
