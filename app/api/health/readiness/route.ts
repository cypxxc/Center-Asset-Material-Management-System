import { NextResponse } from 'next/server'
import { checkReadiness, toPublicReadiness } from '@/lib/health/checks'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await checkReadiness()
  const publicResult = toPublicReadiness(result)

  return NextResponse.json(publicResult, {
    status: result.ready ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
