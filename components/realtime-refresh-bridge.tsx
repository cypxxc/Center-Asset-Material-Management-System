'use client'

import { useRealtimeRefresh, type RealtimeRefreshOptions, type RealtimeTable } from '@/hooks/use-realtime-refresh'

export function RealtimeRefreshBridge({
  tables,
  options,
}: {
  tables: RealtimeTable[]
  options?: boolean | RealtimeRefreshOptions
}) {
  useRealtimeRefresh(tables, options)
  return null
}
