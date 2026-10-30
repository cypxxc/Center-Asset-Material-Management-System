'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from 'radix-ui'
import { Clock, LogOut, ShieldAlert } from 'lucide-react'
import { signOut } from '@/features/auth/actions'

interface IdleSessionTimeoutProps {
  /** Timeout in seconds before auto logout (default: 30 minutes = 1800s) */
  timeoutSeconds?: number
  /** Countdown warning duration in seconds (default: 60s) */
  warningSeconds?: number
}

export function IdleSessionTimeout({
  timeoutSeconds = 1800,
  warningSeconds = 60,
}: IdleSessionTimeoutProps) {
  const router = useRouter()
  const [isWarningOpen, setIsWarningOpen] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(warningSeconds)

  const lastActivityRef = useRef<number>(0)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleLogout = useCallback(async () => {
    setIsWarningOpen(false)
    try {
      await signOut()
    } catch {
      // Fallback
    }
    router.push('/login?reason=idle_timeout')
  }, [router])

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

    // Record activity timestamp
    const recordActivity = () => {
      // Only reset activity timestamp if not currently showing warning modal
      if (!isWarningOpen) {
        lastActivityRef.current = Date.now()
      }
    }

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    events.forEach(event => {
      window.addEventListener(event, recordActivity, { passive: true })
    })

    // Check idle status every 2 seconds
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - lastActivityRef.current) / 1000)
      const threshold = timeoutSeconds - warningSeconds

      if (elapsedSeconds >= timeoutSeconds) {
        // Complete timeout triggered
        clearInterval(interval)
        handleLogout()
      } else if (elapsedSeconds >= threshold && !isWarningOpen) {
        // Enter warning phase
        setIsWarningOpen(true)
        setSecondsRemaining(timeoutSeconds - elapsedSeconds)

        // Start countdown ticker
        if (!countdownTimerRef.current) {
          countdownTimerRef.current = setInterval(() => {
            setSecondsRemaining(prev => {
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
      events.forEach(event => {
        window.removeEventListener(event, recordActivity)
      })
      clearInterval(interval)
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
    }
  }, [handleLogout, isWarningOpen, timeoutSeconds, warningSeconds])

  return (
    <Dialog.Root open={isWarningOpen} onOpenChange={setIsWarningOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[99998] animate-in fade-in duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border border-border p-6 rounded-xl shadow-2xl z-[99999] space-y-5 animate-in zoom-in-95 duration-200 focus:outline-hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <Dialog.Title className="text-base font-bold text-foreground">
                แจ้งเตือนการหมดเวลาเซสชัน (Idle Timeout)
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground mt-0.5">
                เพื่อความปลอดภัยของข้อมูลในระบบราชการ
              </Dialog.Description>
            </div>
          </div>

          <p className="text-sm text-foreground/80 leading-relaxed">
            คุณไม่ได้ใช้งานระบบมาระยะหนึ่ง เพื่อความปลอดภัย ระบบจะออกจากระบบโดยอัตโนมัติในอีก:
          </p>

          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-muted/60 border border-border rounded-lg text-foreground font-mono text-xl font-bold">
            <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
            <span>{secondsRemaining} วินาที</span>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-border bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>ออกจากระบบทันที</span>
            </button>
            <button
              type="button"
              onClick={stayLoggedIn}
              autoFocus
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors"
            >
              <span>คงอยู่ในระบบต่อไป</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
