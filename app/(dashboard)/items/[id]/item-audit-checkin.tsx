'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ClipboardCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { recordPhysicalAuditAction } from '@/features/items/actions'

interface ItemAuditCheckinProps {
  itemId: string
  itemName: string
  lastAuditedAt?: string | null
  lastAuditedBy?: string | null
  lastAuditedNote?: string | null
}

export function ItemAuditCheckin({
  itemId,
  itemName,
  lastAuditedAt,
  lastAuditedBy,
  lastAuditedNote,
}: ItemAuditCheckinProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [statusMessage, setStatusMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showNoteInput, setShowNoteInput] = React.useState(false)
  const [note, setNote] = React.useState('')

  const handleCheckin = () => {
    setStatusMessage(null)
    startTransition(async () => {
      const res = await recordPhysicalAuditAction(itemId, note)
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: res.message ? `${res.message} (${itemName})` : `บันทึกการตรวจนับ ${itemName} สำเร็จ`,
        })
        setShowNoteInput(false)
        setNote('')
        router.refresh()
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'ไม่สามารถบันทึกได้' })
      }
    })
  }

  const formattedDate = lastAuditedAt
    ? new Date(lastAuditedAt).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 sm:p-5 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-950">
              การตรวจนับครุภัณฑ์ทางกายภาพ (Physical Inventory Audit)
            </h4>
            <div className="text-xs text-emerald-800/90 mt-0.5">
              {formattedDate ? (
                <span>
                  ตรวจนับล่าสุด: <span className="font-semibold">{formattedDate}</span>
                  {lastAuditedBy && <span> โดย {lastAuditedBy}</span>}
                  {lastAuditedNote && <span className="italic text-emerald-700"> ({lastAuditedNote})</span>}
                </span>
              ) : (
                <span className="text-slate-500">ยังไม่มีบันทึกการตรวจนับครุภัณฑ์นี้ในปีงบประมาณปัจจุบัน</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!showNoteInput && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowNoteInput(true)}
              disabled={isPending}
              className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-100/60"
            >
              ระบุหมายเหตุ
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleCheckin}
            disabled={isPending}
            className="text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                ยืนยันตรวจพบของ / สภาพปกติ
              </>
            )}
          </Button>
        </div>
      </div>

      {showNoteInput && (
        <div className="flex items-center gap-2 pt-2 border-t border-emerald-200/60">
          <input
            type="text"
            placeholder="หมายเหตุเพิ่มเติม เช่น สภาพสมบูรณ์พร้อมใช้งาน, มีรอยขีดข่วนเล็กน้อย..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-emerald-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowNoteInput(false)
              setNote('')
            }}
            className="text-xs text-slate-600"
          >
            ยกเลิก
          </Button>
        </div>
      )}

      {statusMessage && (
        <div
          className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              : 'bg-rose-100 text-rose-900 border border-rose-300'
          }`}
        >
          {statusMessage.text}
        </div>
      )}
    </div>
  )
}
