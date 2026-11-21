'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MaterialReturnForm } from '@/features/materials/material-return-form'
import { CheckCircle2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

import { partialApproveDisbursement } from '../actions'
import { DisbursementReturnModal, type ReturnModalItem } from './disbursement-return-modal'
import type { DisbursementRow } from '../types'

export function TransactionItemsTable({ document, userRole, reference }: { document: DisbursementRow; userRole: string; reference: string }) {
  const router = useRouter()
  const isAdmin = userRole === 'admin'
  const isPendingApproval = isAdmin && document.status === 'pending_approval'
  const canReturn = isAdmin && document.transaction_type === 'asset_borrow' && ['active_borrow', 'partially_returned'].includes(document.status)
  const canReturnMaterial = isAdmin && document.transaction_type === 'material_issue' && ['confirmed', 'partially_returned'].includes(document.status)

  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set())
  const [returnItems, setReturnItems] = useState<ReturnModalItem[]>([])
  const [returnModalOpen, setReturnModalOpen] = useState(false)
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
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <header className="border-b border-border px-4 py-3">
        <p className="text-[11px] font-semibold text-muted-foreground">รายละเอียดเอกสาร</p>
        <div className="flex items-center justify-between gap-3">
          <h3 className="min-w-0 break-words text-sm font-extrabold text-card-foreground">{reference}</h3>
          {isPendingApproval && (
            <Button
              type="button"
              size="sm"
              disabled={busy || selectedLineIds.size === 0}
              onClick={handlePartialApprove}
              className="h-7 shrink-0 gap-1 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>อนุมัติที่เลือก</span>
            </Button>
          )}
        </div>
      </header>
      <div className="space-y-3 p-3.5 sm:p-4">
      <dl className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
        <dt className="font-medium text-muted-foreground">วัตถุประสงค์</dt>
        <dd className="mt-0.5 break-words text-card-foreground">{document.purpose || '—'}</dd>
      </dl>
      {document.status === 'rejected' && <p className="whitespace-pre-wrap break-words rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive"><strong>เหตุผลที่ไม่อนุมัติ: </strong>{document.reversal_reason || 'ไม่อนุมัติคำขอ'}</p>}
      {canReturn && canSelect && selectedLineIds.size > 0 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={busy}
            onClick={openSelectedReturn}
            className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>รับคืนที่เลือก ({selectedLineIds.size})</span>
          </Button>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table aria-label="รายการวัสดุในคำขอ" className="table-data-uniform w-full min-w-[600px] text-left text-xs text-card-foreground [&_th]:px-2.5 [&_th]:py-2 [&_th]:font-semibold [&_td]:px-2.5 [&_td]:py-1.5">
        <thead className="border-b border-border/80 bg-muted/75 text-muted-foreground">
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
        <tbody className="divide-y divide-border/40">
          {items.map((item) => {
            const outstanding = Math.max(0, item.issued_qty - item.returned_qty)
            const isEligible = isPendingApproval ? item.status === 'pending' : (canReturn ? outstanding > 0 : false)
            const isChecked = selectedLineIds.has(item.line_id)

            return (
              <tr key={item.line_id} className={cn("h-[42px] align-middle transition-colors hover:bg-muted/40", isChecked && "bg-primary/5")}>
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
                      <img src={item.image_url} alt="" width={36} height={36} loading="lazy" className="size-8 shrink-0 rounded-lg border border-border bg-muted/40 object-contain" />
                    )}
                    <span className="min-w-0 break-words font-medium">{item.item_name}</span>
                  </div>
                </td>
                <td className="text-right tabular-nums">{item.requested_qty}</td>
                <td className="text-right tabular-nums">{item.issued_qty}</td>
                <td className="text-right tabular-nums">{item.returned_qty}</td>
                <td className="text-right tabular-nums">{document.transaction_type === 'asset_borrow' ? outstanding : '—'}</td>
                <td className="whitespace-nowrap text-center [&>span]:gap-1 [&>span]:rounded-md [&>span]:border [&>span]:border-current/20 [&>span]:px-2 [&>span]:text-[10.5px] [&>span]:leading-tight">
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
      </div>

      </div>

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
