'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Clock, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface IdleSessionTimeoutProps {
  timeoutSeconds?: number
  warningSeconds?: number
  sessionExpiresAt?: string
}

const STORAGE_KEY = 'camms_last_activity'
const CHANNEL_NAME = 'camms_idle_sync'

export function IdleSessionTimeout({ timeoutSeconds = 8 * 60 * 60, warningSeconds = 60, sessionExpiresAt }: IdleSessionTimeoutProps) {
  const sessionDeadline = sessionExpiresAt ? Date.parse(sessionExpiresAt) : Infinity
  const [isWarningOpen, setIsWarningOpen] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(warningSeconds)
  const [isSessionWarning, setIsSessionWarning] = useState(false)
  const isWarningOpenRef = useRef(false)
  const hasLoggedOutRef = useRef(false)
  const lastActivityRef = useRef(0)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    // Native modal dialogs share the browser top layer with the item form.
    // A body portal with z-index alone would remain behind that form.
    if (!dialog.open) dialog.showModal()
    if (isExpired) dialog.focus()
  }, [isWarningOpen, isExpired])

  const handleLogout = useCallback(() => {
    if (hasLoggedOutRef.current) return
    hasLoggedOutRef.current = true
    isWarningOpenRef.current = false
    setIsWarningOpen(false)
    setIsExpired(true)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch { /* Storage may be unavailable. */ }
    try {
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel(CHANNEL_NAME)
        channel.postMessage({ type: 'LOGOUT' })
        channel.close()
      }
    } catch { /* Storage events also synchronize logout. */ }
  }, [])

  useEffect(() => {
    if (!isExpired) return
    // Use the server route to revoke the session and delete its HttpOnly cookie.
    // A brief delay lets users read why they are being redirected.
    const timer = setTimeout(() => window.location.replace('/api/auth/logout'), 1500)
    return () => clearTimeout(timer)
  }, [isExpired])

  const stayLoggedIn = useCallback(() => {
    if (hasLoggedOutRef.current) return
    if (Date.now() >= sessionDeadline || Date.now() - lastActivityRef.current >= timeoutSeconds * 1000) {
      handleLogout()
      return
    }
    lastActivityRef.current = Date.now()
    isWarningOpenRef.current = false
    setIsWarningOpen(false)
    setSecondsRemaining(warningSeconds)
    try {
      localStorage.setItem(STORAGE_KEY, String(lastActivityRef.current))
    } catch { /* Keep the in-memory timer working. */ }
  }, [handleLogout, sessionDeadline, timeoutSeconds, warningSeconds])

  useEffect(() => {
    const now = Date.now()
    lastActivityRef.current = now
    try {
      const stored = Number(localStorage.getItem(STORAGE_KEY))
      if (Number.isFinite(stored) && stored > 0 && stored <= now) lastActivityRef.current = stored
      else localStorage.setItem(STORAGE_KEY, String(now))
    } catch { /* Keep the in-memory timer working. */ }

    const checkTimeout = () => {
      if (hasLoggedOutRef.current) return
      const idleRemaining = timeoutSeconds - Math.floor((Date.now() - lastActivityRef.current) / 1000)
      const sessionRemaining = Math.ceil((sessionDeadline - Date.now()) / 1000)
      const remaining = Math.min(idleRemaining, sessionRemaining)
      if (remaining <= 0) {
        handleLogout()
      } else {
        isWarningOpenRef.current = remaining <= warningSeconds
        setIsWarningOpen(isWarningOpenRef.current)
        setIsSessionWarning(sessionRemaining <= warningSeconds)
        if (isWarningOpenRef.current) setSecondsRemaining(remaining)
      }
    }

    const onActivity = () => {
      if (hasLoggedOutRef.current) return
      // A click after browser sleep must not revive an already expired timer.
      if (Date.now() >= sessionDeadline || Date.now() - lastActivityRef.current >= timeoutSeconds * 1000) {
        handleLogout()
        return
      }
      if (isWarningOpenRef.current) return
      lastActivityRef.current = Date.now()
      try {
        localStorage.setItem(STORAGE_KEY, String(lastActivityRef.current))
      } catch { /* Keep the in-memory timer working. */ }
    }

    const acceptRemoteActivity = (timestamp: number) => {
      if (hasLoggedOutRef.current || !Number.isFinite(timestamp) || timestamp <= 0 || timestamp > Date.now()) return
      lastActivityRef.current = Math.max(lastActivityRef.current, timestamp)
      checkTimeout()
    }
    const onStorageChange = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      if (event.newValue === null) handleLogout()
      else acceptRemoteActivity(Number(event.newValue))
    }
    let channel: BroadcastChannel | null = null
    try {
      if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel(CHANNEL_NAME)
        channel.onmessage = (event) => {
          if (event.data?.type === 'LOGOUT') handleLogout()
          else if (event.data?.type === 'ACTIVITY' && typeof event.data.timestamp === 'number') acceptRemoteActivity(event.data.timestamp)
        }
      }
    } catch { /* Storage events remain available. */ }

    const activityEvents = ['keydown', 'click', 'scroll', 'pointerdown', 'mousemove', 'touchstart'] as const
    for (const event of activityEvents) window.addEventListener(event, onActivity, { passive: true })
    window.addEventListener('storage', onStorageChange)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkTimeout()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    const interval = setInterval(checkTimeout, 1000)
    checkTimeout()
    return () => {
      for (const event of activityEvents) window.removeEventListener(event, onActivity)
      window.removeEventListener('storage', onStorageChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      channel?.close()
      clearInterval(interval)
    }
  }, [handleLogout, sessionDeadline, timeoutSeconds, warningSeconds])

  if (!isWarningOpen && !isExpired) return null

  return createPortal(
        <dialog ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="idle-timeout-title" aria-describedby="idle-timeout-description" tabIndex={-1} onCancel={(event) => event.preventDefault()} style={{ pointerEvents: 'auto' }} className="fixed inset-0 z-[99999] m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md space-y-5 overflow-y-auto rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-xs focus:outline-none">
          <div className="flex items-center gap-3">
            <ShieldAlert className="size-8 shrink-0 text-amber-600" aria-hidden="true" />
            <h2 id="idle-timeout-title" className="text-base font-semibold">
              {isExpired ? 'เซสชันหมดอายุ' : 'แจ้งเตือนการหมดเวลาเซสชัน (Idle Timeout)'}
            </h2>
          </div>
          <p id="idle-timeout-description" className="text-sm leading-relaxed text-muted-foreground">
            {isExpired ? 'หมดเวลาใช้งานระบบ กำลังออกจากระบบและพาไปหน้าเข้าสู่ระบบใหม่โดยอัตโนมัติ' : isSessionWarning ? 'เซสชันกำลังครบกำหนด 8 ชั่วโมง กรุณาบันทึกงานและเข้าสู่ระบบใหม่เมื่อหมดเวลา' : 'คุณไม่ได้ใช้งานระบบมาระยะหนึ่ง ระบบจะออกจากระบบอัตโนมัติเมื่อหมดเวลา กรุณายืนยันหากต้องการใช้งานต่อ'}
          </p>
          {isExpired ? (
            <p role="status" className="text-center text-sm text-muted-foreground">กำลังไปหน้าเข้าสู่ระบบ...</p>
          ) : (
            <>
              <div role="timer" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/60 p-3 font-mono text-xl font-semibold">
                <Clock className="size-5 text-amber-600" aria-hidden="true" />
                <span>{secondsRemaining} วินาที</span>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={handleLogout} className="flex-1">ออกจากระบบทันที</Button>
                {!isSessionWarning &&
                  <Button type="button" onClick={stayLoggedIn} className="flex-1">คงอยู่ในระบบต่อไป</Button>
                }
              </div>
            </>
          )}
        </dialog>,
    document.body
  )
}
