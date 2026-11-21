'use client'

import { useEffect, useState } from 'react'
import { Dialog } from 'radix-ui'
import { AlertTriangle, CheckCircle2, Loader2, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { loadOriginLocationAction, returnCustody } from '../actions'
import type { CustodyHistoryRow } from '../custody-postgres'

interface AssetReturnModalProps {
  item: CustodyHistoryRow
  onClose: () => void
  onSuccess: () => void
}

export function AssetReturnModal({ item, onClose, onSuccess }: AssetReturnModalProps) {
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [condition, setCondition] = useState<'normal' | 'damaged'>('normal')
  const [reason, setReason] = useState('')
  const [originLocation, setOriginLocation] = useState<{ id: string; name: string } | null>(null)
  const [isLoadingOrigin, setIsLoadingOrigin] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!item.item_id) {
      queueMicrotask(() => {
        if (!cancelled) setIsLoadingOrigin(false)
      })
      return
    }
    queueMicrotask(() => {
      if (!cancelled) setIsLoadingOrigin(true)
    })
    loadOriginLocationAction(item.item_id, item.to_responsible || item.current_responsible)
      .then((res) => {
        if (cancelled) return
        if (res.ok && res.data) {
          setOriginLocation(res.data)
        } else {
          setOriginLocation(null)
        }
        setIsLoadingOrigin(false)
      })
      .catch(() => {
        if (!cancelled) {
          setOriginLocation(null)
          setIsLoadingOrigin(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [item.item_id, item.to_responsible, item.current_responsible])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!item.item_id) {
      setError('ไม่พบรหัสครุภัณฑ์')
      return
    }
    if (!originLocation) {
      setError('ไม่พบข้อมูลสถานที่ต้นทางเดิมก่อนสั่งจ่ายในระบบ ไม่สามารถทำรายการรับคืนได้')
      return
    }
    if (!reason.trim()) {
      setError('กรุณาระบุเหตุผลในการคืน')
      return
    }
    setError('')
    setIsSubmitting(true)
    try {
      const result = await returnCustody({
        item_id: item.item_id,
        return_date: returnDate,
        condition,
        reason: reason.trim(),
        location_id: originLocation.id,
      })
      if (!result.ok) {
        setError(result.error || 'บันทึกรับคืนไม่สำเร็จ')
        return
      }
      onSuccess()
    } catch {
      setError('บันทึกรับคืนไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentCustodian = item.to_responsible || item.current_responsible || item.from_responsible || '-'

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !isSubmitting) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs" />
        <Dialog.Content
          aria-describedby={undefined}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => { if (isSubmitting) event.preventDefault() }}
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-hidden border-l border-border bg-card text-card-foreground shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-right sm:max-w-[460px]"
        >
          <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground">รายละเอียดครุภัณฑ์</p>
              <Dialog.Title className="text-sm font-extrabold sm:text-base">รับคืนครุภัณฑ์</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button variant="outline" size="icon" className="size-8 shrink-0 rounded-lg bg-muted/60 text-muted-foreground sm:size-9" disabled={isSubmitting} aria-label="ปิด">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4 sm:p-5">
              {error && (
                <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                  {error}
                </div>
              )}

              {/* Item Info Card */}
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-semibold text-foreground">{item.item_name}</p>
                    <p className="break-all font-mono text-[11px] text-muted-foreground">{item.asset_no || 'ไม่ระบุเลขครุภัณฑ์'}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    ครุภัณฑ์
                  </span>
                </div>
                <div className="flex items-center gap-2 border-t border-border/50 pt-1.5 text-xs">
                  <span className="text-muted-foreground">ผู้ถือครองปัจจุบัน:</span>
                  <span className="font-medium text-foreground">{currentCustodian}</span>
                </div>
              </div>

              {/* Return Date */}
              <div className="space-y-1">
                <label htmlFor="return-date" className="text-xs font-medium text-foreground">
                  วันที่รับคืน <span className="text-destructive">*</span>
                </label>
                <input
                  id="return-date"
                  type="date"
                  required
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  disabled={isSubmitting}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-ring"
                />
              </div>

              {/* Condition */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  สภาพครุภัณฑ์ <span className="text-destructive">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCondition('normal')}
                    disabled={isSubmitting}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-xl border-2 py-2 px-3 transition-colors cursor-pointer bg-background',
                      condition === 'normal'
                        ? 'border-emerald-600 dark:border-emerald-500'
                        : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    )}
                  >
                    <CheckCircle2
                      className={cn(
                        'size-4 shrink-0',
                        condition === 'normal' ? 'text-emerald-600 dark:text-emerald-500' : 'text-muted-foreground'
                      )}
                    />
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        condition === 'normal' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                      )}
                    >
                      ปกติ
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCondition('damaged')}
                    disabled={isSubmitting}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-xl border-2 py-2 px-3 transition-colors cursor-pointer bg-background',
                      condition === 'damaged'
                        ? 'border-amber-600 dark:border-amber-500'
                        : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    )}
                  >
                    <AlertTriangle
                      className={cn(
                        'size-4 shrink-0',
                        condition === 'damaged' ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'
                      )}
                    />
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        condition === 'damaged' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                      )}
                    >
                      ชำรุด
                    </span>
                  </button>
                </div>
              </div>

              {/* Return Reason */}
              <div className="space-y-1">
                <label htmlFor="return-reason" className="text-xs font-medium text-foreground">
                  เหตุผลในการคืน <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="return-reason"
                  required
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="ระบุเหตุผลในการคืนครุภัณฑ์..."
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-ring"
                />
              </div>

              {/* Location (Read-only Auto-detected Origin) */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  สถานที่จัดเก็บหลังรับคืน (ต้นทางเดิมก่อนสั่งจ่าย)
                </label>
                {isLoadingOrigin ? (
                  <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-muted/20 px-3 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>กำลังตรวจสอบสถานที่ต้นทางเดิม...</span>
                  </div>
                ) : originLocation ? (
                  <div className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-muted/20 px-3 text-xs text-foreground">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate font-medium">{originLocation.name}</span>
                    </div>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium">
                      ต้นทางเดิม
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 text-xs font-medium text-destructive">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      <span>ไม่พบข้อมูลสถานที่ต้นทางเดิม</span>
                    </div>
                    <p role="alert" className="text-[11px] text-destructive">
                      ไม่พบประวัติสถานที่ต้นทางก่อนสั่งจ่าย ระบบป้องกันการบันทึก กรุณาตรวจสอบหรือระบุข้อมูลต้นทางในระบบก่อนทำรายการ
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-border px-4 py-3 sm:px-5 bg-muted/20">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={onClose}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !reason.trim() || !returnDate || !originLocation || isLoadingOrigin}
                className="gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  'ยืนยันรับคืน'
                )}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
