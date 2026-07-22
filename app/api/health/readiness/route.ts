import { NextResponse } from 'next/server'
import { checkReadiness, toPublicReadiness } from '@/lib/health/checks'
import { logger } from '@/lib/logging'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await checkReadiness()

  if (!result.ready) {
    for (const [dependency, check] of Object.entries(result.checks)) {
      if (check.status === 'down') {
        logger.error(
          { operation: 'readinessCheck', feature: 'health', details: { dependency } },
          check.error,
        )
      }
    }
  }

  const publicResult = toPublicReadiness(result)

  return NextResponse.json(publicResult, {
    status: result.ready ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  })
}
