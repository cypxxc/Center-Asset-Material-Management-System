import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getStatusSnapshot } from '@/lib/health'

function matchesBearerSecret(headerValue: string | null, secret: string): boolean {
  if (!headerValue) return false
  const actual = Buffer.from(headerValue, 'utf8')
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function GET() {
  const secret = process.env.HEALTH_STATUS_SECRET
  if (process.env.NODE_ENV === 'production') {
    const authorization = (await headers()).get('authorization')
    if (!secret || !matchesBearerSecret(authorization, secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const snapshot = getStatusSnapshot()

  return NextResponse.json(snapshot, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
