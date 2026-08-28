'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type RealtimeTable = 'items' | 'categories' | 'locations' | 'units' | 'audit_logs'

export function useRealtimeRefresh(tables: RealtimeTable[], enabled = true) {
  const router = useRouter()
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tableKey = tables.join(',')

  useEffect(() => {
    if (!enabled || !tableKey) return
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return

    router.refresh()
    const supabase = createClient()
    const tableList = tableKey.split(',') as RealtimeTable[]
    const channel = supabase
      .channel(`camms-realtime-${tableKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableList[0] }, () => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(() => router.refresh(), 150)
      })

    for (const table of tableList.slice(1)) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current)
        refreshTimer.current = setTimeout(() => router.refresh(), 150)
      })
    }

    void channel.subscribe()

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      void supabase.removeChannel(channel)
    }
  }, [enabled, router, tableKey])
}
