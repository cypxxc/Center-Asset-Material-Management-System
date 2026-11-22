'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MaterialReturnForm } from '@/features/materials/material-return-form'

import { partialApproveDisbursement, partialReturnDisbursement } from '../actions'
import { bangkokCalendarDate } from '../borrow-dates'
import type { DisbursementRow } from '../types'

export function TransactionItemsTable({ document, userRole, reference }: { document: DisbursementRow; userRole: string; reference: string }) {
  const router = useRouter()
  const isAdmin = userRole === 'admin'
  const isPendingApproval = isAdmin && document.status === 'pending_approval'
  const canReturn = isAdmin && document.transaction_type === 'asset_borrow' && ['active_borrow', 'partially_returned'].includes(document.status)
  const canReturnMaterial = isAdmin && document.transaction_type === 'material_issue' && ['confirmed', 'partially_returned'].includes(document.status)

  const [busy, setBusy] = useState(false)
  const [returningLineId, setReturningLineId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const items = document.requested_items || []
  async function handlePartialApprove(lineId: string) {
    if (!isPendingApproval || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await partialApproveDisbursement({
        disbursement_id: document.id,
        line_ids: [lineId],
      })
      if (!res.ok) {
        setError(res.error || 'เกิดข้อผิดพลาดในการอนุมัติ')
        return
      }
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาดในการอนุมัติ')
    } finally {
      setBusy(false)
    }
  }

  async function handleReturnLine(item: typeof items[0]) {
    if (!canReturn || busy) return
    setBusy(true)
    setReturningLineId(item.line_id)
    setError('')
    try {
      const result = await partialReturnDisbursement({
        disbursement_id: document.id,
        items: [{
          line_id: item.line_id,
          item_id: item.item_id,
          condition: 'normal',
          return_date: bangkokCalendarDate(),
          reason: 'คืนสภาพปกติ',
        }],
      })
      if (!result.ok) {
        setError(result.error || 'บันทึกรับคืนไม่สำเร็จ')
        return
      }
      router.refresh()
    } catch {
      setError('บันทึกรับคืนไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setReturningLineId(null)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {document.status === 'rejected' && <p className="whitespace-pre-wrap break-words rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive"><strong>เหตุผลที่ไม่อนุมัติ: </strong>{document.reversal_reason || 'ไม่อนุมัติคำขอ'}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table aria-label="รายการวัสดุในคำขอ" className="table-data-uniform w-full min-w-[760px] table-fixed text-left text-xs text-card-foreground [&_th]:px-2.5 [&_th]:py-2 [&_th]:font-semibold [&_td]:px-2.5 [&_td]:py-1.5">
        <colgroup>
          <col className="w-[16%]" />
          <col />
          <col className="w-[6%]" />
          <col className="w-[6%]" />
          <col className="w-[7%]" />
          <col className="w-[7%]" />
          <col className="w-[11%]" />
          <col className="w-[110px]" />
        </colgroup>
        <thead className="border-b border-border/80 bg-muted/75 text-muted-foreground">
          <tr>
            <th scope="col" className="text-left">เลขครุภัณฑ์</th>
            <th scope="col" className="text-left">รายการวัสดุ-ครุภัณฑ์</th>
            <th scope="col" className="text-right">ขอ</th>
            <th scope="col" className="text-right">จ่าย</th>
            <th scope="col" className="text-right">คืนแล้ว</th>
            <th scope="col" className="text-right">คงค้าง</th>
            <th scope="col" className="text-center">สถานะรายการ</th>
            <th scope="col" className="text-center pr-6 sm:pr-7">จัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {items.map((item) => {
            const outstanding = Math.max(0, item.issued_qty - item.returned_qty)

            return (
              <tr key={item.line_id} className="h-[42px] align-middle transition-colors hover:bg-muted/40">
                <td className="text-left font-mono text-xs truncate" title={item.asset_no || undefined}>{item.asset_no || '—'}</td>
                <td className="text-left">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Inventory URLs may point to either backend's existing storage. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {item.image_url && (
                      <img src={item.image_url} alt="" width={36} height={36} loading="lazy" className="size-8 shrink-0 rounded-lg border border-border bg-muted/40 object-contain" />
                    )}
                    <span className="min-w-0 truncate font-medium" title={item.item_name}>{item.item_name}</span>
                  </div>
                </td>
                <td className="text-right tabular-nums">{item.requested_qty}</td>
                <td className="text-right tabular-nums">{item.issued_qty}</td>
                <td className="text-right tabular-nums">{item.returned_qty}</td>
                <td className="text-right tabular-nums">{document.transaction_type === 'asset_borrow' ? outstanding : '—'}</td>
                <td className="whitespace-nowrap text-center">
                  {item.status === 'pending' && 'รออนุมัติ'}
                  {item.status === 'issued' && 'อนุมัติแล้ว'}
                  {item.status === 'partially_returned' && 'คืนบางส่วน'}
                  {item.status === 'returned' && 'คืนครบแล้ว'}
                  {item.status === 'reversed' && 'ปฏิเสธ'}
                </td>
                <td className="text-center pr-6 sm:pr-7">
                  <div className="flex items-center justify-center">
                    {isPendingApproval ? (
                      item.status === 'pending' ? (
                        <Button type="button" size="sm" className="min-w-16" disabled={busy} onClick={() => handlePartialApprove(item.line_id)}>
                          อนุมัติ
                        </Button>
                      ) : item.status === 'issued' ? (
                        <span className="text-emerald-600 text-xs font-medium">อนุมัติแล้ว</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )
                    ) : canReturn ? (
                      outstanding > 0 ? (
                        <Button aria-busy={returningLineId === item.line_id}
                          size="sm"
                          variant="outline"
                          className="min-w-16"
                          disabled={busy}
                          aria-label={`คืน ${item.asset_no || item.item_name}`}
                          onClick={() => handleReturnLine(item)}
                        >
                          {returningLineId === item.line_id ? (
                            <span className="flex items-center gap-1">
                              <span>กำลังคืน...</span>
                            </span>
                          ) : (
                            'คืน'
                          )}
                        </Button>
                      ) : (
                        <span className="text-emerald-600 text-xs font-medium">คืนครบแล้ว</span>
                      )
                    ) : canReturnMaterial ? (
                      outstanding > 0 ? (
                        <MaterialReturnForm lineId={item.line_id} remaining={outstanding} />
                      ) : (
                        <span className="text-emerald-600 text-xs font-medium">คืนครบแล้ว</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
          {!items.length && (
            <tr>
              <td colSpan={8} className="text-center text-muted-foreground py-4">
                ไม่มีรายการวัสดุ
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

    </div>
  )
}
