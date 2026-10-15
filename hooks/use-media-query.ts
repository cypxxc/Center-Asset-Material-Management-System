'use client'

import { useSyncExternalStore } from 'react'

function subscribe(query: string, callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia(query)
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function getSnapshot(query: string): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(query).matches
}

function getServerSnapshot(defaultValue: boolean): boolean {
  return defaultValue
}

export function useMediaQuery(query: string, defaultValue = false): boolean {
  return useSyncExternalStore(
    (callback) => subscribe(query, callback),
    () => getSnapshot(query),
    () => getServerSnapshot(defaultValue)
  )
}
