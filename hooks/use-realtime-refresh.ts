'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createTransitionCompletion, startRealtimeRefresh } from './realtime-refresh-controller'

type RealtimeTable = 'items' | 'categories' | 'locations' | 'units' | 'audit_logs'

export function useRealtimeRefresh(tables: RealtimeTable[], enabled = true, { debounceMs = 750 }: { debounceMs?: number } = {}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [completion] = useState(createTransitionCompletion)
  const tableKey = [...new Set(tables)].sort().join(',')

  useEffect(() => {
    completion.observe(isPending)
  }, [completion, isPending])

  useEffect(() => {
    if (!enabled || !tableKey) return
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return

    const supabase = createClient()
    const stop = startRealtimeRefresh({
      tables: tableKey.split(','),
      enabled,
      debounceMs,
      visibility: document,
      refresh: (complete) => {
        completion.begin(complete)
        startTransition(() => router.refresh())
      },
      subscribe: (tableList, onChange) => {
        const channel = supabase.channel(`camms-realtime-${tableKey}`)
        for (const table of tableList) {
          channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
        }
        void channel.subscribe()
        return () => { void supabase.removeChannel(channel) }
      },
    })
    return () => {
      stop()
      completion.cancel()
    }
  }, [completion, debounceMs, enabled, router, startTransition, tableKey])
}
