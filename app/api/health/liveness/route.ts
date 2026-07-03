import { NextResponse } from 'next/server'
import { checkLiveness } from '@/lib/health/checks'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = checkLiveness()

  return NextResponse.json(result, {
    status: result.alive ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
