'use client'

import { useEffect, useState } from 'react'
import { Dialog } from 'radix-ui'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { loadCustodyForm } from '../actions'
import { CustodyAssignmentForm } from './custody-assignment-form'
import { cn } from '@/lib/utils'

export function DisbursementCreateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [data, setData] = useState<NonNullable<Awaited<ReturnType<typeof loadCustodyForm>>['data']> | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadCustodyForm().then((result) => {
      if (cancelled) return
      if (result.ok && result.data) setData(result.data)
      else setError(result.error || 'โหลดรายการวัสดุไม่สำเร็จ')
    }).catch(() => {
      if (!cancelled) setError('โหลดรายการวัสดุไม่สำเร็จ')
    })
    return () => { cancelled = true }
  }, [attempt])

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !isSubmitting) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => { if (isSubmitting) event.preventDefault() }}
          className={cn('fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl', pickerOpen && 'lg:left-[calc(50%+0.5rem)] lg:w-[calc(50vw-2rem)] lg:max-w-2xl lg:translate-x-0')}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-6">
            <Dialog.Title className="text-sm font-semibold">สั่งจ่ายสิ่งของส่วนกลาง</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" disabled={isSubmitting} aria-label="ปิดฟอร์มสั่งจ่าย"><X className="size-4" /></Button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
            {data ? (
              <CustodyAssignmentForm items={data.items} users={data.users} onCancel={onClose} onSuccess={onSuccess} onPendingChange={setIsSubmitting} onPickerOpenChange={setPickerOpen} />
            ) : error ? (
              <div role="alert" className="flex min-h-40 flex-col items-center justify-center gap-3">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" onClick={() => { setError(''); setAttempt((value) => value + 1) }}>ลองใหม่</Button>
              </div>
            ) : (
              <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />กำลังโหลดรายการวัสดุ...</div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
