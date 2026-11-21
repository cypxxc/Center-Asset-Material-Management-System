'use client'

import { useEffect, useState } from 'react'
import { Dialog } from 'radix-ui'
import { AlertTriangle, CheckCircle2, Loader2, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { loadOriginLocationAction, partialReturnDisbursement } from '../actions'

export interface ReturnModalItem {
  line_id: string
  item_id: string
  item_name: string
  asset_no: string | null
  unreturned_qty?: number
}

interface DisbursementReturnModalProps {
  disbursementId: string
  recipientName: string
  items: ReturnModalItem[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function DisbursementReturnModal({ isOpen, ...props }: DisbursementReturnModalProps) {
  return isOpen ? <ReturnForm {...props} /> : null
}

function ReturnForm({
  disbursementId,
  recipientName,
  items,
  onClose,
  onSuccess,
}: Omit<DisbursementReturnModalProps, 'isOpen'>) {
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [condition, setCondition] = useState<'normal' | 'damaged' | 'lost'>('normal')
  const [reason, setReason] = useState('')
  const [locationMap, setLocationMap] = useState<Record<string, { id: string; name: string } | null>>({})
  const [isLoadingLocations, setIsLoadingLocations] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (items.length === 0) return
    let active = true
    queueMicrotask(() => {
      if (active) {
        setIsLoadingLocations(true)
        setError('')
      }
    })

    Promise.all(
      items.map(async (item) => {
        try {
          const res = await loadOriginLocationAction(item.item_id, recipientName)
          return { itemId: item.item_id, location: res.ok && res.data ? res.data : null }
        } catch {
          return { itemId: item.item_id, location: null }
        }
      })
    ).then((results) => {
      if (!active) return
      const map: Record<string, { id: string; name: string } | null> = {}
      for (const r of results) {
        map[r.itemId] = r.location
      }
      setLocationMap(map)
      setIsLoadingLocations(false)
    })

    return () => {
      active = false
    }
  }, [items, recipientName])

  // Check if any item lacks origin location
  const missingOrigins = items.filter((item) => !locationMap[item.item_id])
  const hasMissingOrigin = condition !== 'lost' && !isLoadingLocations && missingOrigins.length > 0

  // Check unique origin locations
  const validLocations = items
    .map((item) => locationMap[item.item_id])
    .filter((loc): loc is { id: string; name: string } => loc !== null && loc !== undefined)
  const uniqueLocationIds = Array.from(new Set(validLocations.map((l) => l.id)))
  const sameLocation = uniqueLocationIds.length <= 1 && validLocations.length > 0 ? validLocations[0] : null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (items.length === 0) {
      setError('กรุณาเลือกรายการที่ต้องการคืน')
      return
    }
    if (hasMissingOrigin) {
      setError('ไม่พบสถานที่ต้นทางเดิมสำหรับบางรายการ ไม่สามารถทำรายการรับคืนได้')
      return
    }
    if (!reason.trim()) {
      setError('กรุณาระบุเหตุผลในการคืน')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const result = await partialReturnDisbursement({
        disbursement_id: disbursementId,
        items: items.map((item) => ({
          line_id: item.line_id,
          item_id: item.item_id,
          condition,
          return_date: returnDate,
          reason: reason.trim(),
        })),
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

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !isSubmitting) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => { if (isSubmitting) event.preventDefault() }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-5">
            <Dialog.Title className="text-sm font-semibold">
              รับคืนครุภัณฑ์ ({items.length} รายการ)
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" disabled={isSubmitting} aria-label="ปิด">
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

              {/* Items List */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  รายการครุภัณฑ์ที่เลือกคืน ({items.length} รายการ)
                </label>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-muted/20 divide-y divide-border">
                  {items.map((item) => {
                    const loc = locationMap[item.item_id]
                    return (
                      <div key={item.line_id} className="p-2.5 flex items-start justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{item.item_name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{item.asset_no || 'ไม่ระบุเลขครุภัณฑ์'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {isLoadingLocations ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Loader2 className="size-3 animate-spin" /> ตรวจสอบต้นทาง...
                            </span>
                          ) : loc ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <MapPin className="size-3" /> {loc.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-medium">
                              <AlertTriangle className="size-3" /> ไม่พบต้นทางเดิม
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Read-only Location Summary */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  สถานที่จัดเก็บหลังรับคืน (ต้นทางเดิมก่อนการยืม)
                </label>
                {condition === 'lost' ? (
                  <div className="rounded-lg border border-input bg-muted/20 p-2.5 text-xs text-muted-foreground">
                    บันทึกสูญหายโดยไม่ส่งคืนไปยังสถานที่จัดเก็บ
                  </div>
                ) : isLoadingLocations ? (
                  <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-muted/20 px-3 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>กำลังตรวจสอบสถานที่ต้นทางเดิม...</span>
                  </div>
                ) : hasMissingOrigin ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>ไม่พบข้อมูลสถานที่ต้นทางเดิมสำหรับบางรายการ กรุณาตรวจสอบข้อมูลก่อนทำรายการ</span>
                  </div>
                ) : sameLocation ? (
                  <div className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-muted/20 px-3 text-xs text-foreground">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate font-medium">{sameLocation.name}</span>
                    </div>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium">
                      ต้นทางเดิมทุกรายการ
                    </span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-input bg-muted/20 p-2.5 text-xs text-muted-foreground">
                    คืนกลับตามสถานที่ต้นทางเดิมของแต่ละรายการตามที่แสดงด้านบน
                  </div>
                )}
              </div>

              {/* Return Date */}
              <div className="space-y-1">
                <label htmlFor="return-date-input" className="text-xs font-medium text-foreground">
                  วันที่รับคืน <span className="text-destructive">*</span>
                </label>
                <input
                  id="return-date-input"
                  type="date"
                  required
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  disabled={isSubmitting}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-ring"
                />
              </div>

              {/* Condition (Framed selection, NOT solid fill) */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">
                  สภาพครุภัณฑ์ <span className="text-destructive">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCondition('normal')}
                    aria-pressed={condition === 'normal'}
                    disabled={isSubmitting}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 px-3 transition-colors cursor-pointer bg-background',
                      condition === 'normal'
                        ? 'border-emerald-600 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    )}
                  >
                    <CheckCircle2
                      className={cn(
                        'size-4 shrink-0',
                        condition === 'normal' ? 'text-emerald-600 dark:text-emerald-500' : 'text-muted-foreground'
                      )}
                    />
                    <span className="text-xs">ปกติ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCondition('damaged')}
                    aria-pressed={condition === 'damaged'}
                    disabled={isSubmitting}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 px-3 transition-colors cursor-pointer bg-background',
                      condition === 'damaged'
                        ? 'border-amber-600 dark:border-amber-500 text-amber-600 dark:text-amber-400 font-semibold'
                        : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    )}
                  >
                    <AlertTriangle
                      className={cn(
                        'size-4 shrink-0',
                        condition === 'damaged' ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'
                      )}
                    />
                    <span className="text-xs">ชำรุด</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCondition('lost')}
                    aria-pressed={condition === 'lost'}
                    disabled={isSubmitting}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 px-3 transition-colors cursor-pointer bg-background',
                      condition === 'lost'
                        ? 'border-destructive text-destructive font-semibold'
                        : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    )}
                  >
                    <span className="text-xs">สูญหาย</span>
                  </button>
                </div>
              </div>

              {/* Reason (Required textarea) */}
              <div className="space-y-1">
                <label htmlFor="return-reason-input" className="text-xs font-medium text-foreground">
                  เหตุผลในการคืน <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="return-reason-input"
                  required
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="ระบุเหตุผลในการคืนครุภัณฑ์..."
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-xs shadow-xs focus-visible:outline-2 focus-visible:outline-ring"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-muted/20 px-4 py-3 sm:px-5">
              <Button type="button" variant="outline" size="sm" disabled={isSubmitting} onClick={onClose}>
                ยกเลิก
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || isLoadingLocations || hasMissingOrigin || items.length === 0}
                className="font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  `ยืนยันรับคืน (${items.length} รายการ)`
                )}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
