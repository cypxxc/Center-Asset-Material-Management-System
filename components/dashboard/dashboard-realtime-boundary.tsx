'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type { RealtimeRefreshBridge } from '@/components/realtime-refresh-bridge'

const DeferredRealtimeRefreshBridge = dynamic(
  () => import('@/components/realtime-refresh-bridge').then((module) => module.RealtimeRefreshBridge),
  { ssr: false },
)

type RealtimeTables = ComponentProps<typeof RealtimeRefreshBridge>['tables']

export function DashboardRealtimeBoundary({ tables }: { tables: RealtimeTables }) {
  return <DeferredRealtimeRefreshBridge tables={tables} />
}
