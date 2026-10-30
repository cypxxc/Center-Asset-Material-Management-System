'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { signOut } from '@/features/auth/actions'

interface IdleSessionTimeoutProps {
  timeoutSeconds?: number
  warningSeconds?: number
}

export function IdleSessionTimeout({
  timeoutSeconds = 1800,
  warningSeconds = 60,
}: IdleSessionTimeoutProps) {
  const [isWarningOpen, setIsWarningOpen] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(warningSeconds)

  const lastActivityRef = useRef<number>(0)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleLogout = useCallback(() => {
    setIsWarningOpen(false)
    signOut().catch(() => {})
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/login?reason=idle_timeout'
  }, [])

  const stayLoggedIn = useCallback(() => {
    lastActivityRef.current = Date.now()
    setIsWarningOpen(false)
    setSecondsRemaining(warningSeconds)
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }, [warningSeconds])

  useEffect(() => {
    lastActivityRef.current = Date.now()

    const onActivity = () => {
      if (!isWarningOpen) lastActivityRef.current = Date.now()
    }

    window.addEventListener('keydown', onActivity, { passive: true })
    window.addEventListener('click', onActivity, { passive: true })
    window.addEventListener('scroll', onActivity, { passive: true })

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000)
      const threshold = timeoutSeconds - warningSeconds

      if (elapsed >= timeoutSeconds) {
        clearInterval(interval)
        handleLogout()
      } else if (elapsed >= threshold && !isWarningOpen) {
        setIsWarningOpen(true)
        setSecondsRemaining(timeoutSeconds - elapsed)

        if (!countdownTimerRef.current) {
          countdownTimerRef.current = setInterval(() => {
            setSecondsRemaining((prev) => {
              if (prev <= 1) {
                if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
                handleLogout()
                return 0
              }
              return prev - 1
            })
          }, 1000)
        }
      }
    }, 2000)

    return () => {
      window.removeEventListener('keydown', onActivity)
      window.removeEventListener('click', onActivity)
      window.removeEventListener('scroll', onActivity)
      clearInterval(interval)
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    }
  }, [handleLogout, isWarningOpen, timeoutSeconds, warningSeconds])

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
              เพื่อความปลอดภัยของข้อมูลในระบบราชการ
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
