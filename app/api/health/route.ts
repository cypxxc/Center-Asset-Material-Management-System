import { NextResponse } from 'next/server'
import { checkLegacyHealth } from '@/lib/health/checks'

export const dynamic = 'force-dynamic'

/** Legacy aggregate health — prefer /api/health/readiness + /liveness + /status */
export async function GET() {
  const payload = await checkLegacyHealth()
  const isHealthy = payload.status === 'healthy'

  return NextResponse.json(payload, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  })
}
