type RefreshOptions = {
  tables: string[]
  enabled: boolean
  visibility: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>
  refresh: () => void
  subscribe: (tables: string[], onChange: () => void) => () => void
}

export function startRealtimeRefresh({ tables, enabled, visibility, refresh, subscribe }: RefreshOptions): () => void {
  if (!enabled || tables.length === 0) return () => {}

  let dirty = false
  let stopped = false
  let trailingTimer: ReturnType<typeof setTimeout> | undefined
  let maxWaitTimer: ReturnType<typeof setTimeout> | undefined
  const clearTimers = () => {
    clearTimeout(trailingTimer)
    clearTimeout(maxWaitTimer)
    trailingTimer = undefined
    maxWaitTimer = undefined
  }
  const flush = () => {
    clearTimers()
    if (stopped || !dirty || visibility.visibilityState !== 'visible') return
    dirty = false
    refresh()
  }
  const onChange = () => {
    if (stopped) return
    dirty = true
    if (visibility.visibilityState !== 'visible') return
    clearTimeout(trailingTimer)
    trailingTimer = setTimeout(flush, 750)
    // Keep an uninterrupted event stream from postponing refresh indefinitely.
    maxWaitTimer ??= setTimeout(flush, 5_000)
  }
  const onVisibilityChange = () => {
    if (visibility.visibilityState === 'visible') flush()
    else clearTimers()
  }
  const unsubscribe = subscribe(tables, onChange)
  visibility.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    if (stopped) return
    stopped = true
    clearTimers()
    visibility.removeEventListener('visibilitychange', onVisibilityChange)
    unsubscribe()
  }
}
