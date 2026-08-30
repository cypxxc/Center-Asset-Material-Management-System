'use client'

import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'

export function RealtimeRefreshBridge({ tables }: { tables: ('items' | 'categories' | 'locations' | 'units' | 'audit_logs')[] }) {
  useRealtimeRefresh(tables)
  return null
}
