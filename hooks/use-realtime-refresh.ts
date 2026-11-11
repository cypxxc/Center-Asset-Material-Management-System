'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export type RealtimeTable = 'items' | 'categories' | 'locations' | 'units' | 'audit_logs'

export interface RealtimeRefreshOptions {
  enabled?: boolean
  debounceDelay?: number
  maxWait?: number
  pauseOnHidden?: boolean
}

export function useRealtimeRefresh(
  tables: RealtimeTable[],
  options: boolean | RealtimeRefreshOptions = true
) {
  const router = useRouter()
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxWaitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRefreshTime = useRef<number>(0)
  const hasPendingRefresh = useRef<boolean>(false)
  const tableKey = [...tables].sort().join(',')

  const enabled = typeof options === 'boolean' ? options : (options.enabled ?? true)
  const debounceDelay = typeof options === 'object' && options.debounceDelay !== undefined ? options.debounceDelay : 150
  const maxWait = typeof options === 'object' && options.maxWait !== undefined ? options.maxWait : 500
  const pauseOnHidden = typeof options === 'object' && options.pauseOnHidden !== undefined ? options.pauseOnHidden : false

  useEffect(() => {
    if (!enabled || !tableKey) return

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

    const executeRefresh = () => {
      if (pauseOnHidden && typeof document !== 'undefined' && document.hidden) {
        hasPendingRefresh.current = true
        cleanupTimers()
        return
      }
      cleanupTimers()
      lastRefreshTime.current = Date.now()
      router.refresh()
    }

    const scheduleRefresh = () => {
      if (pauseOnHidden && typeof document !== 'undefined' && document.hidden) {
        hasPendingRefresh.current = true
        return
      }

      const now = Date.now()

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

    const handleVisibilityChange = () => {
      if (pauseOnHidden && typeof document !== 'undefined' && !document.hidden) {
        if (hasPendingRefresh.current) {
          hasPendingRefresh.current = false
          scheduleRefresh()
        }
      }
    }

    if (pauseOnHidden && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    if (typeof EventSource !== 'undefined') {
      const events = new EventSource(`/api/events?tables=${encodeURIComponent(tableKey)}`)
      let isInitialConnect = true
      events.onmessage = (message) => {
        if (message.data === 'heartbeat') return
        if (isInitialConnect && message.data === 'reconnect') {
          isInitialConnect = false
          return
        }
        isInitialConnect = false
        scheduleRefresh()
      }
      return () => {
        if (pauseOnHidden && typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
        events.close()
        cleanupTimers()
      }
    }

  }, [enabled, tableKey, debounceDelay, maxWait, pauseOnHidden, router])
}
