import { NextResponse } from 'next/server'
import { checkReadiness } from '@/lib/health/checks'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await checkReadiness()

  return NextResponse.json(result, {
    status: result.ready ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
