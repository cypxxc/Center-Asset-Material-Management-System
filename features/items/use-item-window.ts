'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ItemBatchWindow, saveItemWindow, takeItemWindow } from './batch-window'
import type { ItemBatchResult, ItemListSearchParams } from './types'

export function useItemWindow(identity: string, params: ItemListSearchParams, seed: ItemBatchResult) {
  const [store] = useState(() => new ItemBatchWindow(seed, async (cursor, signal) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => { if (value && key !== 'page') query.set(key, value) })
    if (cursor) query.set('cursor', cursor)
    const response = await fetch(`/api/items/batch?${query}`, { signal, cache: 'no-store' })
    if (!response.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่')
    return response.json()
  }))
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [viewport, setViewport] = useState({ top: 0, height: 600, width: 1000 })
  const scrollRef = useRef<HTMLDivElement>(null)
  const attachScroll = useCallback((element: HTMLDivElement | null) => { scrollRef.current = element }, [])
  const pendingAnchor = useRef<number | null>(null)
  const seedRef = useRef(seed.items)
  const columns = view === 'list' ? 1 : Math.max(2, Math.min(5, Math.floor((viewport.width - 32) / 220)))
  const rowHeight = view === 'list' ? 64 : 220
  const offset = view === 'list' ? 44 : 16
  const anchor = Math.max(0, Math.floor((viewport.top - offset) / rowHeight)) * columns
  const first = Math.max(0, Math.floor((viewport.top - offset) / rowHeight) - 3) * columns
  const last = Math.min(store.count, (Math.ceil((viewport.top + viewport.height - offset) / rowHeight) + 3) * columns)
  const previousLayout = useRef({ columns, rowHeight, anchor })
  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const previous = previousLayout.current
    const nextAnchor = pendingAnchor.current ?? (previous.columns !== columns || previous.rowHeight !== rowHeight ? previous.anchor : null)
    if (nextAnchor !== null) {
      element.scrollTop = Math.floor(nextAnchor / columns) * rowHeight + offset
      pendingAnchor.current = null
      setViewport(v => ({ ...v, top: element.scrollTop }))
    }
    previousLayout.current = { columns, rowHeight, anchor: nextAnchor ?? anchor }
  }, [columns, rowHeight, offset, anchor, state])
  useEffect(() => {
    const saved = takeItemWindow(identity)
    if (saved) {
      pendingAnchor.current = saved.anchor
      // Restore the external, in-memory navigation snapshot after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView(saved.view)
      void store.restore(saved.state, saved.anchor)
    }
    return () => store.dispose()
  }, [identity, store])
  useEffect(() => {
    if (seedRef.current !== seed.items) { seedRef.current = seed.items; void store.refresh(seed.total) }
  }, [seed.items, seed.total, store])
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const update = () => setViewport({ top: element.scrollTop, height: element.clientHeight || 600, width: element.clientWidth || 1000 })
    update()
    element.addEventListener('scroll', update, { passive: true })
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    observer?.observe(element)
    return () => { element.removeEventListener('scroll', update); observer?.disconnect() }
  }, [])
  useEffect(() => { void store.ensure(first, last, anchor) }, [first, last, anchor, state, store])
  const slots = Array.from({ length: Math.max(0, last - first) }, (_, i) => store.at(first + i))
  return {
    store, state, view, setView, attachScroll, columns, slots,
    topSpace: Math.floor(first / columns) * rowHeight,
    bottomSpace: Math.max(0, Math.ceil(store.count / columns) - Math.ceil(last / columns)) * rowHeight,
    loaded: state.batches.flatMap(batch => batch.items?.flatMap(item => item ? [item] : []) ?? []),
    save: () => saveItemWindow({ identity, state, view, anchor }),
    optimisticUpdate: store.optimisticUpdate,
    optimisticDelete: store.optimisticDelete,
    rollback: store.rollback,
    snapshot: store.snapshot,
  }
}

