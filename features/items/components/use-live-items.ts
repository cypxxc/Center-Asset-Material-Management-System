'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { startRealtimeRefresh } from '@/hooks/realtime-refresh-controller'
import { useLiveSidebar, type SidebarData } from '@/components/layout/live-sidebar'
import { itemListQuery } from '../list-query'
import type { ItemListResult, ItemListSearchParams } from '../types'

export function useLiveItems(initial: ItemListResult, params: ItemListSearchParams, authRevision?: string) {
  const router = useRouter()
  const refreshAuthorization = useEffectEvent(() => router.refresh())
  const query = itemListQuery(params).toString()
  const source = initial.items
  const { update: updateSidebar } = useLiveSidebar()
  const [snapshot, setSnapshot] = useState<{
    source: typeof source; query: string; data?: ItemListResult; error: string | null
  } | null>(null)

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return
    const supabase = createClient()
    let active = true
    let request: AbortController | undefined
    const stop = startRealtimeRefresh({
      tables: ['items'], enabled: true, visibility: document, debounceMs: 2500,
      subscribe: (_tables, onChange) => {
        const channel = supabase.channel('camms-items-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, onChange)
          .subscribe()
        return () => { void supabase.removeChannel(channel) }
      },
      refresh: complete => {
        request = new AbortController()
        void (async () => {
          try {
            const response = await fetch(`/api/items/live?${query}`, {
              credentials: 'same-origin', cache: 'no-store',
              signal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
            })
            if (response.status === 401) {
              // Re-run the protected page guard when the current session is revoked.
              // Ordinary item events never refresh the route.
              if (active) refreshAuthorization()
              return
            }
            if (!response.ok) throw new Error('Unable to refresh items')
            const data: ItemListResult & { sidebarData?: SidebarData; authRevision?: string } = await response.json()
            if (active) {
              if (authRevision !== undefined && data.authRevision !== authRevision) {
                // Refresh role-dependent controls and layout after a profile change.
                refreshAuthorization()
                return
              }
              setSnapshot({ source, query, data, error: null })
              if (data.sidebarData) updateSidebar(data.sidebarData)
            }
          } catch {
            if (active) setSnapshot(previous => ({
              source, query,
              data: previous?.source === source && previous.query === query ? previous.data : undefined,
              error: 'อัปเดตข้อมูลล่าสุดไม่สำเร็จ กรุณาโหลดหน้าใหม่',
            }))
          } finally { complete() }
        })()
      },
    })
    return () => { active = false; stop(); request?.abort() }
  }, [query, source, updateSidebar, authRevision])

  const current = snapshot?.source === source && snapshot.query === query ? snapshot : null
  return { data: current?.data ?? initial, error: current?.error ?? null }
}
