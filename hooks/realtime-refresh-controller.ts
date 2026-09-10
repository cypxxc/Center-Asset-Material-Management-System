type RefreshOptions = {
  tables: string[]
  enabled: boolean
  visibility: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>
  debounceMs?: number
  refresh: (complete: () => void) => void
  subscribe: (tables: string[], onChange: () => void) => () => void
}

// React may render pending=false before a newly started transition becomes pending.
export function createTransitionCompletion() {
  let complete: (() => void) | undefined
  let observedPending = false
  return {
    begin(callback: () => void) {
      complete = callback
      observedPending = false
    },
    observe(pending: boolean) {
      if (!complete) return
      if (pending) observedPending = true
      else if (observedPending) {
        const callback = complete
        complete = undefined
        observedPending = false
        callback()
      }
    },
    cancel() {
      complete = undefined
      observedPending = false
    },
  }
}

export function startRealtimeRefresh({ tables, enabled, visibility, refresh, subscribe, debounceMs = 750 }: RefreshOptions): () => void {
  if (!enabled || tables.length === 0) return () => {}

  let dirty = false
  let stopped = false
  let refreshing = false
  let ready = false
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
    ready = true
    if (refreshing) return
    dirty = false
    ready = false
    refreshing = true
    let completed = false
    const complete = () => {
      if (stopped || completed) return
      completed = true
      refreshing = false
      if (ready) flush()
    }
    try {
      refresh(complete)
    } catch (error) {
      completed = true
      refreshing = false
      throw error
    }
  }
  const onChange = () => {
    if (stopped) return
    dirty = true
    if (visibility.visibilityState !== 'visible' || ready) return
    clearTimeout(trailingTimer)
    trailingTimer = setTimeout(flush, debounceMs)
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
