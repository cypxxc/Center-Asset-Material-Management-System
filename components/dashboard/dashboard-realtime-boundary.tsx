'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { RealtimeRefreshBridge } from '@/components/realtime-refresh-bridge'
import type { RealtimeRefreshOptions } from '@/hooks/use-realtime-refresh'

const DeferredRealtimeRefreshBridge = dynamic(
  () => import('@/components/realtime-refresh-bridge').then((module) => module.RealtimeRefreshBridge),
  { ssr: false },
)

type RealtimeTables = ComponentProps<typeof RealtimeRefreshBridge>['tables']

export interface DashboardRealtimeBoundaryProps {
  tables?: RealtimeTables
  options?: RealtimeRefreshOptions
}

export function DashboardRealtimeBoundary({
  tables = ['items', 'categories'],
  options = { debounceDelay: 1000, maxWait: 2500, pauseOnHidden: true },
}: DashboardRealtimeBoundaryProps = {}) {
  return <DeferredRealtimeRefreshBridge tables={tables} options={options} />
}
