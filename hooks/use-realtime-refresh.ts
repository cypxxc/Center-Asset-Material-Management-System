'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type RealtimeTable = 'items' | 'categories' | 'locations' | 'units' | 'audit_logs'

export function useRealtimeRefresh(tables: RealtimeTable[], enabled = true) {
  const router = useRouter()
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxWaitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRefreshTime = useRef<number>(0)
  const tableKey = tables.join(',')

  useEffect(() => {
    if (!enabled || !tableKey) return

    const scheduleRefresh = () => {
      const now = Date.now()
      const maxWait = 500
      const debounceDelay = 150

      const executeRefresh = () => {
        if (refreshTimer.current) {
          clearTimeout(refreshTimer.current)
          refreshTimer.current = null
        }
        if (maxWaitTimer.current) {
          clearTimeout(maxWaitTimer.current)
          maxWaitTimer.current = null
        }
        lastRefreshTime.current = Date.now()
        router.refresh()
      }

      // If elapsed time since last refresh exceeds maxWait, refresh immediately
      if (lastRefreshTime.current > 0 && now - lastRefreshTime.current >= maxWait) {
        executeRefresh()
        return
      }

      // Ensure maxWait guarantee: if a storm of events occurs, trigger within maxWait
      if (!maxWaitTimer.current) {
        const remainingWait = Math.max(0, maxWait - (now - lastRefreshTime.current))
        maxWaitTimer.current = setTimeout(executeRefresh, remainingWait)
      }

      // Debounce delay
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current)
      }
      refreshTimer.current = setTimeout(executeRefresh, debounceDelay)
    }

    const cleanupTimers = () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current)
        refreshTimer.current = null
      }
      if (maxWaitTimer.current) {
        clearTimeout(maxWaitTimer.current)
        maxWaitTimer.current = null
      }
    }

    if (process.env.NEXT_PUBLIC_DATA_BACKEND === 'postgres') {
      const events = new EventSource(`/api/events?tables=${encodeURIComponent(tableKey)}`)
      events.onmessage = (message) => { if (message.data !== 'heartbeat') scheduleRefresh() }
      return () => { events.close(); cleanupTimers() }
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return

    const supabase = createClient()
    const tableList = tableKey.split(',') as RealtimeTable[]
    const channel = supabase
      .channel(`camms-realtime-${tableKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableList[0] }, () => {
        scheduleRefresh()
      })

    for (const table of tableList.slice(1)) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        scheduleRefresh()
      })
    }

    void channel.subscribe()

    return () => {
      cleanupTimers()
      void supabase.removeChannel(channel)
    }
  }, [enabled, router, tableKey])
}
