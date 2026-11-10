'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getSnapshot(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
    ? navigator.onLine
    : true
}

function getServerSnapshot(): boolean {
  return true
}

export function OfflineBanner() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [justReconnected, setJustReconnected] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const handleOnline = () => {
      setJustReconnected(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setJustReconnected(false)
      }, 3500)
    }

    const handleOffline = () => {
      setJustReconnected(false)
      if (timer) clearTimeout(timer)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (timer) clearTimeout(timer)
    }
  }, [])

  if (!isOnline) {
    return (
      <aside
        role="alert"
        aria-live="assertive"
        className="sticky top-0 z-[100] flex w-full items-center justify-center gap-2 bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md animate-in slide-in-from-top duration-300"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span>ขาดการเชื่อมต่ออินเทอร์เน็ต — ระบบจะซิงค์ข้อมูลใหม่อัตโนมัติเมื่อออนไลน์</span>
      </aside>
    )
  }

  if (justReconnected) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className="sticky top-0 z-[100] flex w-full items-center justify-center gap-2 bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md animate-in slide-in-from-top duration-300"
      >
        <Wifi className="h-3.5 w-3.5 shrink-0" />
        <span>เชื่อมต่อสัญญาณอินเทอร์เน็ตเรียบร้อยแล้ว</span>
      </aside>
    )
  }

  return null
}

