'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface SidebarData {
  categories: { id: string; name: string; count: number }[]
  locations: { id: string; name: string; count: number }[]
  counts: { total_assets: number; total_supplies: number; archive_count: number; trash_count: number }
}
const noop = () => {}
const Context = createContext<{ data?: SidebarData; update: (data: SidebarData) => void }>({ update: noop })

export function LiveSidebarProvider({ data, children }: { data: SidebarData; children: ReactNode }) {
  const [live, setLive] = useState<{ source: SidebarData; data: SidebarData } | null>(null)
  const update = useCallback((next: SidebarData) => setLive({ source: data, data: next }), [data])
  const current = live?.source === data ? live.data : data
  const value = useMemo(() => ({ data: current, update }), [current, update])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useLiveSidebar() { return useContext(Context) }
