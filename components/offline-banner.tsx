'use client'

import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [justReconnected, setJustReconnected] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      setIsOnline(true)
      setJustReconnected(true)
      const timer = setTimeout(() => {
        setJustReconnected(false)
      }, 3500)
      return () => clearTimeout(timer)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setJustReconnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline && !justReconnected) return null

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
