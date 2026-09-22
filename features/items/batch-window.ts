import type { ItemBatchResult, ItemListRow } from './types'

export interface BatchSlot {
  start: number
  length: number
  requestCursor?: string
  nextCursor: string | null
  items?: (ItemListRow | null)[]
}
export interface WindowState {
  batches: BatchSlot[]
  total: number | null
  loading: boolean
  error: string | null
}
export type BatchFetcher = (cursor: string | undefined, signal: AbortSignal) => Promise<ItemBatchResult>

/** Cursor metadata survives eviction; only twenty batches of records remain resident. */
export class ItemBatchWindow {
  state: WindowState
  private listeners = new Set<() => void>()
  private controller?: AbortController
  private generation = 0
  private retryAction?: () => Promise<void>
  private anchor = 0
  constructor(seed: ItemBatchResult, private fetcher: BatchFetcher, restored?: WindowState) {
    this.state = restored ? { ...restored, loading: false, error: null } : {
      batches: [{ start: 0, length: seed.items.length, nextCursor: seed.nextCursor, items: seed.items }],
      total: seed.total, loading: false, error: null,
    }
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  getSnapshot = () => this.state
  private publish(state: WindowState) { this.state = state; this.listeners.forEach(listener => listener()) }
  dispose() { this.generation++; this.controller?.abort(); this.controller = undefined }
  restore(state: WindowState, anchor: number) {
    this.anchor = anchor
    this.publish({ ...state, loading: false, error: null })
    return this.refresh()
  }
  get count() { const last = this.state.batches.at(-1); return last ? last.start + last.length : 0 }
  get hasMore() { return Boolean(this.state.batches.at(-1)?.nextCursor) }
  at(index: number) { const batch = this.state.batches.find(b => index >= b.start && index < b.start + b.length); return batch?.items ? batch.items[index - batch.start] : undefined }
  private bounded(batches: BatchSlot[]) {
    const resident = batches.filter(b => b.items).sort((a, b) => Math.abs(a.start - this.anchor) - Math.abs(b.start - this.anchor))
    const keep = new Set(resident.slice(0, 20))
    return batches.map(b => b.items && !keep.has(b) ? { ...b, items: undefined } : b)
  }
  private unique(items: ItemListRow[], batches: BatchSlot[]) {
    const ids = new Set(batches.flatMap(b => b.items?.flatMap(item => item ? [item.id] : []) ?? []))
    return items.map(item => { if (ids.has(item.id)) return null; ids.add(item.id); return item })
  }
  private async run(action: (signal: AbortSignal) => Promise<WindowState>, retry: () => Promise<void>) {
    if (this.controller) return
    const controller = new AbortController(), generation = this.generation
    this.controller = controller
    this.retryAction = retry
    this.publish({ ...this.state, loading: true, error: null })
    try {
      const next = await action(controller.signal)
      if (generation === this.generation) this.publish({ ...next, loading: false, error: null })
    } catch (error) {
      if (generation === this.generation && !controller.signal.aborted) this.publish({ ...this.state, loading: false, error: error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ' })
    } finally {
      if (generation === this.generation) { this.controller = undefined; if (this.state.loading) this.publish({ ...this.state, loading: false }) }
    }
  }
  retry = async () => { await this.retryAction?.() }
  loadMore = async () => {
    const cursor = this.state.batches.at(-1)?.nextCursor
    if (!cursor) return
    await this.run(async signal => {
      const result = await this.fetcher(cursor, signal)
      const batch = { start: this.count, length: result.items.length, requestCursor: cursor, nextCursor: result.nextCursor, items: this.unique(result.items, this.state.batches) }
      return { ...this.state, batches: this.bounded([...this.state.batches, batch]) }
    }, this.loadMore)
  }
  ensure = async (start: number, end: number, anchor = start) => {
    this.anchor = anchor
    if (this.state.error || this.controller) return
    const index = this.state.batches.findIndex(b => !b.items && b.start < end && b.start + b.length > start)
    if (index >= 0) return this.reload(index)
    if (end >= this.count - 5) await this.loadMore()
  }
  private reload = async (index: number) => {
    await this.run(async signal => {
      const old = this.state.batches[index]
      const result = await this.fetcher(old.requestCursor, signal)
      const batches = this.state.batches.slice()
      if (old.nextCursor !== result.nextCursor || old.length !== result.items.length) batches.splice(index + 1)
      // Shifted rows can still exist in stale downstream batches. Discard those
      // boundaries before deduplication so their rows do not erase fresh data.
      batches[index] = { ...old, items: this.unique(result.items, batches.filter((_, i) => i !== index)), length: result.items.length, nextCursor: result.nextCursor }
      return { ...this.state, batches: this.bounded(batches) }
    }, () => this.reload(index))
  }
  refresh = async (seedTotal?: number | null) => {
    // Supersede an append; mutation/realtime refresh must never be dropped behind it.
    this.dispose()
    const startIndex = Math.max(0, this.state.batches.findIndex(b => this.anchor >= b.start && this.anchor < b.start + b.length))
    await this.run(async signal => {
      const old = this.state.batches
      let cursor = old[startIndex].requestCursor
      let start = old[startIndex].start
      const fresh: BatchSlot[] = []
      const endIndex = Math.min(old.length, startIndex + 2)
      let total = seedTotal ?? this.state.total
      for (let i = startIndex; i < endIndex; i++) {
        const result = await this.fetcher(cursor, signal)
        fresh.push({ start, requestCursor: cursor, nextCursor: result.nextCursor, length: result.items.length, items: this.unique(result.items, fresh) })
        total = result.total ?? total
        start += result.items.length
        if (!result.nextCursor) break
        cursor = result.nextCursor
      }
      // Earlier boundaries are useful for returning upward, but their data is stale.
      return { ...this.state, total, batches: [...old.slice(0, startIndex).map(b => ({ ...b, items: undefined })), ...fresh] }
    }, this.refresh)
  }
}

export interface ItemWindowSnapshot { identity: string; state: WindowState; view: 'list' | 'grid'; anchor: number; savedAt: number }
let snapshot: ItemWindowSnapshot | undefined
export function saveItemWindow(value: Omit<ItemWindowSnapshot, 'savedAt'>, now = Date.now()) { snapshot = { ...value, savedAt: now } }
export function takeItemWindow(identity: string, now = Date.now()) {
  const saved = snapshot
  snapshot = undefined
  return saved?.identity === identity && now - saved.savedAt < 300_000 ? saved : undefined
}
