'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { signOut } from '@/features/auth/actions'

interface IdleSessionTimeoutProps {
  timeoutSeconds?: number
  warningSeconds?: number
}

const STORAGE_KEY = 'camms_last_activity'
const CHANNEL_NAME = 'camms_idle_sync'

export function IdleSessionTimeout({
  timeoutSeconds = 1800,
  warningSeconds = 60,
}: IdleSessionTimeoutProps) {
  const [isWarningOpen, setIsWarningOpen] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(warningSeconds)

  const isWarningOpenRef = useRef(false)
  const hasLoggedOutRef = useRef(false)
  const lastActivityRef = useRef<number>(0)

  const handleLogout = useCallback(async () => {
    if (hasLoggedOutRef.current) return
    hasLoggedOutRef.current = true

    setIsWarningOpen(false)
    isWarningOpenRef.current = false

    // Sync logout to other open tabs
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel(CHANNEL_NAME)
        bc.postMessage({ type: 'LOGOUT' })
        bc.close()
      }
    } catch {
      // ignore
    }

    // Clear client-side state
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY)
        sessionStorage.clear()
        document.cookie = 'camms_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      }
    } catch {
      // ignore
    }

    // Call server logout (both dedicated route and server action with timeout fallback)
    try {
      await Promise.race([
        fetch('/api/auth/logout', { method: 'POST', keepalive: true }),
        signOut(),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]).catch(() => {})
    } catch {
      // ignore
    }

    // Navigate to login page with idle_timeout reason
    if (typeof window !== 'undefined') {
      window.location.replace('/login?reason=idle_timeout')
    }
  }, [])

  const stayLoggedIn = useCallback(() => {
    const now = Date.now()
    lastActivityRef.current = now
    isWarningOpenRef.current = false
    hasLoggedOutRef.current = false
    setIsWarningOpen(false)
    setSecondsRemaining(warningSeconds)

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, String(now))
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel(CHANNEL_NAME)
          bc.postMessage({ type: 'ACTIVITY', timestamp: now })
          bc.close()
        }
      }
    } catch {
      // ignore
    }
  }, [warningSeconds])

  useEffect(() => {
    const now = Date.now()
    lastActivityRef.current = now
    hasLoggedOutRef.current = false

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const storedTime = parseInt(stored, 10)
          if (!isNaN(storedTime) && storedTime > 0 && storedTime <= now) {
            lastActivityRef.current = Math.max(lastActivityRef.current, storedTime)
          }
        }
        localStorage.setItem(STORAGE_KEY, String(now))
      }
    } catch {
      // ignore
    }

    const onActivity = () => {
      if (!isWarningOpenRef.current && !hasLoggedOutRef.current) {
        const currentNow = Date.now()
        lastActivityRef.current = currentNow
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, String(currentNow))
          }
        } catch {
          // ignore
        }
      }
    }

    const activityEvents = ['keydown', 'click', 'scroll', 'pointerdown', 'mousemove', 'touchstart'] as const
    for (const ev of activityEvents) {
      window.addEventListener(ev, onActivity, { passive: true })
    }

    // Multi-tab sync via BroadcastChannel and storage event
    let channel: BroadcastChannel | null = null
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel(CHANNEL_NAME)
        channel.onmessage = (event) => {
          if (event.data?.type === 'LOGOUT') {
            hasLoggedOutRef.current = true
            window.location.replace('/login?reason=idle_timeout')
          } else if (event.data?.type === 'ACTIVITY' && typeof event.data.timestamp === 'number') {
            lastActivityRef.current = Math.max(lastActivityRef.current, event.data.timestamp)
            if (isWarningOpenRef.current) {
              isWarningOpenRef.current = false
              setIsWarningOpen(false)
            }
          }
        }
      }
    } catch {
      // ignore
    }

    const onStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const remoteTime = parseInt(e.newValue, 10)
        if (!isNaN(remoteTime)) {
          lastActivityRef.current = Math.max(lastActivityRef.current, remoteTime)
          if (isWarningOpenRef.current) {
            isWarningOpenRef.current = false
            setIsWarningOpen(false)
          }
        }
      }
    }
    window.addEventListener('storage', onStorageChange)

    const checkTimeout = () => {
      if (hasLoggedOutRef.current) return

      const currentNow = Date.now()
      const elapsed = Math.floor((currentNow - lastActivityRef.current) / 1000)
      const remaining = timeoutSeconds - elapsed

      if (remaining <= 0) {
        hasLoggedOutRef.current = true
        handleLogout()
      } else if (remaining <= warningSeconds) {
        if (!isWarningOpenRef.current) {
          isWarningOpenRef.current = true
          setIsWarningOpen(true)
        }
        setSecondsRemaining(remaining)
      } else {
        if (isWarningOpenRef.current) {
          isWarningOpenRef.current = false
          setIsWarningOpen(false)
        }
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkTimeout()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const interval = setInterval(checkTimeout, 1000)

    return () => {
      for (const ev of activityEvents) {
        window.removeEventListener(ev, onActivity)
      }
      window.removeEventListener('storage', onStorageChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (channel) {
        try {
          channel.close()
        } catch {}
      }
      clearInterval(interval)
    }
  }, [handleLogout, timeoutSeconds, warningSeconds])

  if (!isWarningOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-timeout-title"
      aria-describedby="idle-timeout-desc"
      className="fixed inset-0 z-[99998] flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={stayLoggedIn}
      />
      <div className="relative w-full max-w-md bg-card border border-border p-6 rounded-xl shadow-2xl z-[99999] space-y-5 animate-in zoom-in-95 duration-200 focus:outline-hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          </div>
          <div>
            <h2 id="idle-timeout-title" className="text-base font-bold text-foreground">
              แจ้งเตือนการหมดเวลาเซสชัน (Idle Timeout)
            </h2>
            <p id="idle-timeout-desc" className="text-xs text-muted-foreground mt-0.5">
              เพื่อความปลอดภัยของข้อมูลในระบบ
            </p>
          </div>
        </div>

        <p className="text-sm text-foreground/80 leading-relaxed">
          คุณไม่ได้ใช้งานระบบมาระยะหนึ่ง เพื่อความปลอดภัย ระบบจะออกจากระบบโดยอัตโนมัติในอีก:
        </p>

        <div className="flex items-center justify-center gap-2 py-3 px-4 bg-muted/60 border border-border rounded-lg text-foreground font-mono text-xl font-bold">
          <svg className="w-5 h-5 text-amber-500 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>{secondsRemaining} วินาที</span>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          <button
            type="button"
            onClick={handleLogout}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-border bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            <span>ออกจากระบบทันที</span>
          </button>
          <button
            type="button"
            onClick={stayLoggedIn}
            autoFocus
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors cursor-pointer"
          >
            <span>คงอยู่ในระบบต่อไป</span>
          </button>
        </div>
      </div>
    </div>
  )
}
