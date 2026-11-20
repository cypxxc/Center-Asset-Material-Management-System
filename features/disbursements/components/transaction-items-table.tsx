'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MaterialReturnForm } from '@/features/materials/material-return-form'
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

import { partialApproveDisbursement, partialRejectDisbursement } from '../actions'
import { DisbursementReturnModal, type ReturnModalItem } from './disbursement-return-modal'
import type { DisbursementRow } from '../types'

export function TransactionItemsTable({ document, userRole }: { document: DisbursementRow; userRole: string }) {
  const router = useRouter()
  const isAdmin = userRole === 'admin'
  const isPendingApproval = isAdmin && document.status === 'pending_approval'
  const canReturn = isAdmin && document.transaction_type === 'asset_borrow' && ['active_borrow', 'partially_returned'].includes(document.status)
  const canReturnMaterial = isAdmin && document.transaction_type === 'material_issue' && ['confirmed', 'partially_returned'].includes(document.status)

  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set())
  const [returnItems, setReturnItems] = useState<ReturnModalItem[]>([])
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const items = document.requested_items || []
  const eligibleLines = items.filter((item) => {
    if (isPendingApproval) return item.status === 'pending'
    if (canReturn) return (item.issued_qty - item.returned_qty) > 0
    return false
  })
  const canSelect = eligibleLines.length > 0
  const allSelected = canSelect && eligibleLines.every((l) => selectedLineIds.has(l.line_id))

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedLineIds(new Set())
    } else {
      setSelectedLineIds(new Set(eligibleLines.map((l) => l.line_id)))
    }
  }

  function toggleLine(lineId: string) {
    const next = new Set(selectedLineIds)
    if (next.has(lineId)) next.delete(lineId)
    else next.add(lineId)
    setSelectedLineIds(next)
  }

  async function handlePartialApprove() {
    if (selectedLineIds.size === 0 || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await partialApproveDisbursement({
        disbursement_id: document.id,
        line_ids: Array.from(selectedLineIds),
      })
      if (!res.ok) {
        setError(res.error || 'เกิดข้อผิดพลาดในการอนุมัติ')
        return
      }
      setSelectedLineIds(new Set())
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาดในการอนุมัติ')
    } finally {
      setBusy(false)
    }
  }

  async function handlePartialReject() {
    if (selectedLineIds.size === 0 || !rejectReason.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await partialRejectDisbursement({
        disbursement_id: document.id,
        line_ids: Array.from(selectedLineIds),
        reason: rejectReason.trim(),
      })
      if (!res.ok) {
        setError(res.error || 'เกิดข้อผิดพลาดในการปฏิเสธ')
        return
      }
      setRejectModalOpen(false)
      setRejectReason('')
      setSelectedLineIds(new Set())
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาดในการปฏิเสธ')
    } finally {
      setBusy(false)
    }
  }

  function openSingleReturn(item: typeof items[0]) {
    setReturnItems([{
      line_id: item.line_id,
      item_id: item.item_id,
      item_name: item.item_name,
      asset_no: item.asset_no,
      unreturned_qty: Math.max(0, item.issued_qty - item.returned_qty),
    }])
    setReturnModalOpen(true)
  }

  function openSelectedReturn() {
    const selected = items
      .filter((i) => selectedLineIds.has(i.line_id) && (i.issued_qty - i.returned_qty) > 0)
      .map((i) => ({
        line_id: i.line_id,
        item_id: i.item_id,
        item_name: i.item_name,
        asset_no: i.asset_no,
        unreturned_qty: Math.max(0, i.issued_qty - i.returned_qty),
      }))
    if (selected.length === 0) return
    setReturnItems(selected)
    setReturnModalOpen(true)
  }

  return (
    <div className="space-y-3">
      {/* Batch Actions Bar */}
      {canSelect && selectedLineIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 p-2 bg-muted/60 rounded-md border border-border text-xs">
          <span className="font-medium">เลือกอยู่ {selectedLineIds.size} รายการ</span>
          <div className="flex items-center gap-2">
            {isPendingApproval && (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setRejectModalOpen(true)}
                  className="h-7 text-xs gap-1"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>ปฏิเสธที่เลือก</span>
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={handlePartialApprove}
                  className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>อนุมัติที่เลือก</span>
                </Button>
              </>
            )}
            {canReturn && (
              <Button
                size="sm"
                disabled={busy}
                onClick={openSelectedReturn}
                className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>รับคืนที่เลือก ({selectedLineIds.size})</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      <table aria-label="รายการวัสดุในคำขอ" className="w-full text-left text-sm [&_th]:px-4 [&_th]:py-2 [&_th]:font-medium [&_td]:px-4 [&_td]:py-3">
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            {canSelect && (
              <th scope="col" className="w-8 text-center px-2">
                <input
                  type="checkbox"
                  aria-label="เลือกทั้งหมด"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-ring cursor-pointer"
                />
              </th>
            )}
            <th scope="col">เลขครุภัณฑ์</th>
            <th scope="col">รายการวัสดุ-ครุภัณฑ์</th>
            <th scope="col" className="text-right">ขอ</th>
            <th scope="col" className="text-right">จ่าย</th>
            <th scope="col" className="text-right">คืนแล้ว</th>
            <th scope="col" className="text-right">คงค้าง</th>
            <th scope="col" className="text-center">สถานะรายการ</th>
            {(canReturn || canReturnMaterial) && <th scope="col" className="text-right">คืน</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => {
            const outstanding = Math.max(0, item.issued_qty - item.returned_qty)
            const isEligible = isPendingApproval ? item.status === 'pending' : (canReturn ? outstanding > 0 : false)
            const isChecked = selectedLineIds.has(item.line_id)

            return (
              <tr key={item.line_id} className={cn("align-middle hover:bg-muted/20", isChecked && "bg-primary/5")}>
                {canSelect && (
                  <td className="text-center px-2">
                    <input
                      type="checkbox"
                      aria-label={`เลือก ${item.item_name}`}
                      disabled={!isEligible}
                      checked={isChecked}
                      onChange={() => toggleLine(item.line_id)}
                      className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-ring cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </td>
                )}
                <td className="font-mono text-xs whitespace-nowrap">{item.asset_no || '—'}</td>
                <td>
                  <div className="flex items-center gap-3">
                    {/* Inventory URLs may point to either backend's existing storage. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {item.image_url && (
                      <img src={item.image_url} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 shrink-0 rounded object-contain" />
                    )}
                    <span className="min-w-0 break-words">{item.item_name}</span>
                  </div>
                </td>
                <td className="text-right tabular-nums">{item.requested_qty}</td>
                <td className="text-right tabular-nums">{item.issued_qty}</td>
                <td className="text-right tabular-nums">{item.returned_qty}</td>
                <td className="text-right tabular-nums">{document.transaction_type === 'asset_borrow' ? outstanding : '—'}</td>
                <td className="whitespace-nowrap text-center">
                  {item.status === 'pending' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      รออนุมัติ
                    </span>
                  )}
                  {item.status === 'issued' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                      อนุมัติแล้ว
                    </span>
                  )}
                  {item.status === 'partially_returned' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
                      คืนบางส่วน
                    </span>
                  )}
                  {item.status === 'returned' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      คืนครบแล้ว
                    </span>
                  )}
                  {item.status === 'reversed' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                      ปฏิเสธ
                    </span>
                  )}
                </td>
                {canReturn && (
                  <td className="text-right">
                    {outstanding > 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        aria-label={`คืน ${item.asset_no || item.item_name}`}
                        onClick={() => openSingleReturn(item)}
                      >
                        คืน
                      </Button>
                    ) : (
                      <span className="text-emerald-600 text-xs font-medium">คืนครบแล้ว</span>
                    )}
                  </td>
                )}
                {canReturnMaterial && (
                  <td className="text-right">
                    <MaterialReturnForm lineId={item.line_id} remaining={outstanding} />
                  </td>
                )}
              </tr>
            )
          })}
          {!items.length && (
            <tr>
              <td colSpan={canSelect ? 9 : 8} className="text-center text-muted-foreground py-4">
                ไม่มีรายการวัสดุ
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handlePartialReject()
            }}
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg space-y-4 text-xs"
          >
            <div className="flex items-center gap-2 text-destructive border-b border-border pb-3">
              <XCircle className="h-5 w-5" />
              <h3 className="font-bold text-sm text-foreground">ปฏิเสธรายการที่เลือก ({selectedLineIds.size} รายการ)</h3>
            </div>
            <div>
              <label htmlFor="batch-reject-reason" className="block text-xs font-medium mb-1.5 text-foreground">
                ระบุเหตุผลในการไม่อนุมัติ <span className="text-destructive">*</span>
              </label>
              <textarea
                id="batch-reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="ระบุเหตุผลในการปฏิเสธ..."
                rows={3}
                required
                className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRejectModalOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={busy || !rejectReason.trim()}
              >
                {busy ? 'กำลังประมวลผล...' : 'ยืนยันปฏิเสธที่เลือก'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Return Modal */}
      <DisbursementReturnModal
        disbursementId={document.id}
        recipientName={document.recipient_name || ''}
        items={returnItems}
        isOpen={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        onSuccess={() => {
          setSelectedLineIds(new Set())
          setReturnModalOpen(false)
          router.refresh()
        }}
      />
    </div>
  )
}
