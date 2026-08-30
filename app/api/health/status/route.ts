import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getStatusSnapshot } from '@/lib/health'

export const dynamic = 'force-dynamic'

export async function GET() {
  const secret = process.env.HEALTH_STATUS_SECRET
  if (process.env.NODE_ENV === 'production') {
    const authorization = (await headers()).get('authorization')
    if (!secret || authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const snapshot = getStatusSnapshot()

  return NextResponse.json(snapshot, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
