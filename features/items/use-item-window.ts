'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ItemBatchWindow, saveItemWindow, takeItemWindow } from './batch-window'
import type { ItemBatchResult, ItemListSearchParams, ItemListRow } from './types'

export interface ScrollToIndexOptions {
  align?: 'auto' | 'start' | 'end' | 'center'
  behavior?: ScrollBehavior
}

export function useItemWindow(identity: string, params: ItemListSearchParams, seed: ItemBatchResult) {
  const fetcher = useCallback(async (cursor: string | undefined, signal: AbortSignal) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => { if (value && key !== 'page') query.set(key, value) })
    if (cursor) query.set('cursor', cursor)
    const response = await fetch(`/api/items/batch?${query}`, { signal, cache: 'no-store' })
    if (!response.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่')
    return response.json()
  }, [params])

  const [store] = useState(() => new ItemBatchWindow(seed, fetcher))

  useEffect(() => {
    store.setFetcher(fetcher)
  }, [store, fetcher])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [viewport, setViewport] = useState({ top: 0, height: 600, width: 1000 })
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const attachScroll = useCallback((element: HTMLDivElement | null) => {
    scrollRef.current = element
    setScrollElement(element)
  }, [])
  const pendingAnchor = useRef<number | null>(null)
  const seedRef = useRef(seed.items)
  const identityRef = useRef(identity)

  const columns = view === 'list' ? 1 : Math.max(2, Math.min(5, Math.floor((viewport.width - 32) / 220)))
  const rowHeight = view === 'list' ? 64 : 220
  const offset = view === 'list' ? 44 : 16
  const overscan = view === 'list' ? 8 : 4
  const totalCount = Math.max(store.count, state.total ?? 0)
  const totalRows = Math.ceil(totalCount / columns)
  const anchor = Math.max(0, Math.floor((viewport.top - offset) / rowHeight)) * columns
  const visibleRows = Math.ceil(viewport.height / rowHeight) + 2 * overscan
  const windowRows = Math.min(totalRows, visibleRows)
  const targetFirstRow = Math.max(0, Math.floor((viewport.top - offset) / rowHeight) - overscan)
  const maxFirstRow = Math.max(0, totalRows - windowRows)
  const safeFirstRow = Math.min(targetFirstRow, maxFirstRow)
  const safeFirst = safeFirstRow * columns
  const last = Math.min(totalCount, (safeFirstRow + windowRows) * columns)
  const previousLayout = useRef({ columns, rowHeight, anchor })

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const previous = previousLayout.current
    const nextAnchor = pendingAnchor.current ?? (previous.columns !== columns || previous.rowHeight !== rowHeight ? previous.anchor : null)
    if (nextAnchor !== null) {
      element.scrollTop = Math.floor(nextAnchor / columns) * rowHeight + offset
      pendingAnchor.current = null
      setViewport(v => (v.top === element.scrollTop ? v : { ...v, top: element.scrollTop }))
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
    if (identityRef.current !== identity) {
      identityRef.current = identity
      seedRef.current = seed.items
      store.resetSeed(seed)
      if (scrollRef.current) scrollRef.current.scrollTop = 0
      setViewport(v => (v.top === 0 ? v : { ...v, top: 0 }))
    }
  }, [identity, seed, store])

  useEffect(() => {
    const prev = seedRef.current
    seedRef.current = seed.items
    const isSame = prev === seed.items || (
      prev.length === seed.items.length &&
      prev.every((item, i) => item.id === seed.items[i]?.id && item.updated_at === seed.items[i]?.updated_at)
    )
    if (!isSame) {
      void store.refresh(seed.total)
    }
  }, [seed.items, seed.total, store])

  useEffect(() => {
    const element = scrollElement
    if (!element) return
    const update = () => {
      const top = element.scrollTop
      const height = element.clientHeight || 600
      const width = element.clientWidth || 1000
      setViewport(v => {
        if (v.top === top && v.height === height && v.width === width) return v
        return { top, height, width }
      })
    }
    update()
    element.addEventListener('scroll', update, { passive: true })
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    observer?.observe(element)
    return () => {
      element.removeEventListener('scroll', update)
      observer?.disconnect()
    }
  }, [scrollElement])

  useEffect(() => { void store.ensure(safeFirst, last, anchor) }, [safeFirst, last, anchor, state, store])
  const slots = Array.from({ length: Math.max(0, last - safeFirst) }, (_, i) => store.at(safeFirst + i))
  const loaded = useMemo(() => {
    const list: ItemListRow[] = []
    for (const batch of state.batches) {
      if (!batch.items) continue
      for (const item of batch.items) {
        if (item) list.push(item)
      }
    }
    return list
  }, [state.batches])

  const save = useCallback(() => saveItemWindow({ identity, state, view, anchor }), [identity, state, view, anchor])

  const scrollToIndex = useCallback((index: number, options?: ScrollToIndexOptions) => {
    if (!Number.isFinite(index) || index < 0 || store.count === 0) return

    const targetIndex = Math.min(Math.floor(index), store.count - 1)
    const align = options?.align ?? 'auto'
    const behavior = options?.behavior ?? 'auto'

    const element = scrollRef.current
    if (!element) {
      pendingAnchor.current = targetIndex
      return
    }

    const currentScrollTop = element.scrollTop
    const currentViewportHeight = element.clientHeight || viewport.height
    const visibleTop = currentScrollTop + offset
    const visibleBottom = currentScrollTop + currentViewportHeight

    const itemTop = Math.floor(targetIndex / columns) * rowHeight + offset
    const itemBottom = itemTop + rowHeight

    let targetScrollTop = currentScrollTop

    if (align === 'start' || (rowHeight > currentViewportHeight && align === 'auto')) {
      targetScrollTop = itemTop - offset
    } else if (align === 'end') {
      targetScrollTop = itemBottom - currentViewportHeight
    } else if (align === 'center') {
      targetScrollTop = itemTop - offset + (rowHeight / 2) - (currentViewportHeight / 2)
    } else {
      if (itemTop < visibleTop) {
        targetScrollTop = itemTop - offset
      } else if (itemBottom > visibleBottom) {
        targetScrollTop = itemBottom - currentViewportHeight
      } else {
        return
      }
    }

    targetScrollTop = Math.max(0, targetScrollTop)
    const maxScroll = Math.max(0, element.scrollHeight - currentViewportHeight)
    if (maxScroll > 0) {
      targetScrollTop = Math.min(targetScrollTop, maxScroll)
    }

    if (behavior === 'smooth' && typeof element.scrollTo === 'function') {
      element.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
    } else {
      element.scrollTop = targetScrollTop
      setViewport(v => (v.top === targetScrollTop ? v : { ...v, top: targetScrollTop }))
    }
  }, [columns, offset, rowHeight, store.count, viewport.height])

  return {
    store, state, view, setView, attachScroll, columns, slots,
    startIndex: safeFirst,
    topSpace: Math.floor(safeFirst / columns) * rowHeight,
    bottomSpace: Math.max(0, Math.ceil(totalCount / columns) - Math.ceil(last / columns)) * rowHeight,
    loaded,
    save,
    scrollToIndex,
    optimisticUpdate: store.optimisticUpdate,
    optimisticDelete: store.optimisticDelete,
    rollback: store.rollback,
    snapshot: store.snapshot,
  }
}

