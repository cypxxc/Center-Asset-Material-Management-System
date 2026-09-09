'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { startRealtimeRefresh } from './realtime-refresh-controller'

type RealtimeTable = 'items' | 'categories' | 'locations' | 'units' | 'audit_logs'

export function useRealtimeRefresh(tables: RealtimeTable[], enabled = true) {
  const router = useRouter()
  const tableKey = [...new Set(tables)].sort().join(',')

  useEffect(() => {
    if (!enabled || !tableKey) return
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return

    const supabase = createClient()
    return startRealtimeRefresh({
      tables: tableKey.split(','),
      enabled,
      visibility: document,
      refresh: () => router.refresh(),
      subscribe: (tableList, onChange) => {
        const channel = supabase.channel(`camms-realtime-${tableKey}`)
        for (const table of tableList) {
          channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
        }
        void channel.subscribe()
        return () => { void supabase.removeChannel(channel) }
      },
    })
  }, [enabled, router, tableKey])
}
