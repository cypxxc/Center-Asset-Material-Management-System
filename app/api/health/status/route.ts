import { NextResponse } from 'next/server'
import { getStatusSnapshot } from '@/lib/health/checks'
import { featureFlags } from '@/lib/feature-flags'
import { metrics } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status = getStatusSnapshot(true)
  const snapshot = {
    ...status,
    featureFlags: featureFlags.list(),
    metrics: metrics._getMemoryExporter().getAggregates(),
  }

  return NextResponse.json(snapshot, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
