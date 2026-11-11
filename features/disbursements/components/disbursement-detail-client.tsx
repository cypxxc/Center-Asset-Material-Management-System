'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Undo2,
  Calendar,
  User,
  Building,
  AlertTriangle,
  FileText,
  Clock,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatDate } from '@/lib/date'
import type { DisbursementRow, DisbursementItemRow, ItemCondition } from '@/features/disbursements/types'
import {
  DisbursementStatusBadge,
  DisbursementTypeBadge,
} from '@/features/disbursements/components/badges'
import {
  confirmDisbursement,
  cancelDisbursementDraft,
  returnDisbursementItem,
  reverseDisbursement,
  rejectDisbursement,
} from '@/features/disbursements/actions'
import { generateDisbursementVoucherHtml } from '@/features/disbursements/print-generator'

interface DetailClientProps {
  doc: DisbursementRow & { items: DisbursementItemRow[] }
  canMutate: boolean
}

export function DisbursementDetailClient({ doc, canMutate }: DetailClientProps) {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Modals state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)

  // Return modal state
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [activeReturnLine, setActiveReturnLine] = useState<DisbursementItemRow | null>(null)
  const [returnQty, setReturnQty] = useState(1)
  const [returnCondition, setReturnCondition] = useState<ItemCondition>('normal')
  const [returnNote, setReturnNote] = useState('')

  // Reversal modal state
  const [reverseModalOpen, setReverseModalOpen] = useState(false)
  const [reversalReason, setReversalReason] = useState('')

  // Reject modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const isDraft = doc.status === 'draft'
  const isPendingApproval = doc.status === 'pending_approval'
  const isBorrow = doc.transaction_type === 'asset_borrow'
  const isConfirmedOrActive = ['confirmed', 'active_borrow'].includes(doc.status)
  const canReturn = canMutate && isBorrow && ['active_borrow', 'partially_returned'].includes(doc.status)

  // Reversal is only allowed if confirmed/active and no partial return has taken place
  const hasReturnedItems = doc.items.some((it) => it.returned_qty > 0)
  const canReverse = canMutate && isConfirmedOrActive && !hasReturnedItems

  function handlePrint() {
    const html = generateDisbursementVoucherHtml(doc, doc.items)
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('กรุณาอนุญาต Pop-up ในเบราว์เซอร์เพื่อพิมพ์เอกสาร')
      return
    }
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  async function handleConfirm() {
    setIsLoading(true)
    setErrorMsg('')
    try {
      const res = await confirmDisbursement(doc.id)
      if (!res.ok) {
        setErrorMsg(res.error || 'เกิดข้อผิดพลาดในการยืนยันเอกสาร')
        return
      }
      setConfirmModalOpen(false)
      setSuccessMsg(`ยืนยันการเบิก-จ่ายสำเร็จ ออกเลขที่เอกสาร: ${res.data?.document_no}`)
      router.refresh()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการยืนยันเอกสาร')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCancelDraft() {
    setIsLoading(true)
    setErrorMsg('')
    try {
      const res = await cancelDisbursementDraft({ id: doc.id })
      if (!res.ok) {
        setErrorMsg(res.error || 'เกิดข้อผิดพลาดในการยกเลิกเอกสาร')
        return
      }
      setCancelModalOpen(false)
      setSuccessMsg('ยกเลิกเอกสารฉบับร่างเรียบร้อยแล้ว')
      router.refresh()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการยกเลิกเอกสาร')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRejectSubmit() {
    setIsLoading(true)
    setErrorMsg('')
    try {
      const res = await rejectDisbursement(doc.id, rejectReason)
      if (!res.ok) {
        setErrorMsg(res.error || 'เกิดข้อผิดพลาดในการปฏิเสธคำขอ')
        return
      }
      setRejectModalOpen(false)
      setSuccessMsg('ปฏิเสธคำขอยืมเรียบร้อยแล้ว')
      router.refresh()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการปฏิเสธคำขอ')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleReturnSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canMutate || !activeReturnLine) return

    setIsLoading(true)
    setErrorMsg('')
    try {
      const res = await returnDisbursementItem({
        line_id: activeReturnLine.id,
        return_qty: returnQty,
        condition: returnCondition,
        note: returnNote || null,
      })
      if (!res.ok) {
        setErrorMsg(res.error || 'เกิดข้อผิดพลาดในการบันทึกรับคืน')
        return
      }
      setReturnModalOpen(false)
      setActiveReturnLine(null)
      setSuccessMsg('บันทึกรับคืนพัสดุสำเร็จ')
      router.refresh()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกรับคืน')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleReverseSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reversalReason.trim()) {
      setErrorMsg('กรุณาระบุเหตุผลการยกเลิก/คืนสภาพ')
      return
    }

    setIsLoading(true)
    setErrorMsg('')
    try {
      const res = await reverseDisbursement({
        disbursement_id: doc.id,
        reason: reversalReason,
      })
      if (!res.ok) {
        setErrorMsg(res.error || 'เกิดข้อผิดพลาดในการคืนสภาพเอกสาร')
        return
      }
      setReverseModalOpen(false)
      setSuccessMsg('คืนสภาพเอกสารและปรับปรุงยอดเรียบร้อยแล้ว')
      router.refresh()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการคืนสภาพเอกสาร')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status Bar */}
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" asChild className="mr-1">
              <Link href="/disbursements" aria-label="กลับไปหน้ารายการ">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <FileText className="h-5 w-5 text-amber-500 shrink-0" aria-hidden="true" />
            <span>{doc.document_no || 'เอกสารฉบับร่าง (ยังไม่ยืนยัน)'}</span>
          </span>
        }
        subtitle={`สร้างเมื่อ ${formatDate(doc.created_at)}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Print Button (Available for confirmed/terminal docs) */}
            {!isDraft && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 shadow-xs"
              >
                <Printer className="h-3.5 w-3.5 text-primary" />
                <span>พิมพ์ใบเบิก-จ่าย (A4)</span>
              </Button>
            )}

            {canMutate && isDraft && (
              <>
                <Button variant="outline" size="sm" asChild className="shadow-xs">
                  <Link href={`/disbursements/${doc.id}/edit`}>
                    <span>แก้ไขร่าง</span>
                  </Link>
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setCancelModalOpen(true)}
                  className="gap-1 shadow-xs"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>ยกเลิกร่าง</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() => setConfirmModalOpen(true)}
                  className="gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>ยืนยันการเบิก-จ่าย</span>
                </Button>
              </>
            )}

            {canMutate && isPendingApproval && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setRejectModalOpen(true)}
                  className="gap-1.5 shadow-xs"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>ไม่อนุมัติ / ปฏิเสธ</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() => setConfirmModalOpen(true)}
                  className="gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>อนุมัติคำขอยืม</span>
                </Button>
              </>
            )}

            {canMutate && canReverse && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReverseModalOpen(true)}
                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 shadow-xs"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>คืนสภาพเอกสาร (Reverse)</span>
              </Button>
            )}
          </div>
        }
      />

      {errorMsg && (
        <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {isPendingApproval && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-sm">คำขอยืมพัสดุกองกลาง (รอการอนุมัติ)</p>
            <p className="opacity-90">
              ผู้ขอยืม: <strong className="font-semibold">{doc.recipient_name}</strong> ({doc.department_name}) • วันที่ต้องการส่งคืน: <strong className="font-semibold">{doc.due_date ? formatDate(doc.due_date) : '-'}</strong>
            </p>
            <p className="opacity-80">วัตถุประสงค์: {doc.purpose}</p>
          </div>
        </div>
      )}

      {doc.status === 'rejected' && (
        <div className="p-4 rounded-xl border border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-sm">คำขอนี้ไม่ได้รับการอนุมัติ</p>
            <p className="opacity-90">เหตุผล: {doc.reversal_reason || 'ไม่อนุมัติคำขอ'}</p>
          </div>
        </div>
      )}

      {/* Metadata Overview Card */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <DisbursementTypeBadge type={doc.transaction_type} />
            <DisbursementStatusBadge status={doc.status} />
          </div>
          {doc.fiscal_year && (
            <span className="text-xs text-muted-foreground font-mono">
              ปีงบประมาณ พ.ศ. {doc.fiscal_year}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div>
              <span className="text-muted-foreground block text-[11px]">ผู้รับพัสดุ / ผู้ยืม</span>
              <span className="font-medium text-foreground">{doc.recipient_name}</span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Building className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
            <div>
              <span className="text-muted-foreground block text-[11px]">กลุ่มงาน</span>
              <span className="font-medium text-foreground">{doc.department_name}</span>
            </div>
          </div>

          {doc.due_date && (
            <div className="flex items-start gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
              <div>
                <span className="text-muted-foreground block text-[11px]">กำหนดส่งคืน</span>
                <span className="font-medium text-foreground">{formatDate(doc.due_date)}</span>
              </div>
            </div>
          )}

          <div className="sm:col-span-2 md:col-span-3">
            <span className="text-muted-foreground block text-[11px]">วัตถุประสงค์การใช้งาน</span>
            <span className="text-foreground">{doc.purpose}</span>
          </div>

          {doc.reversal_reason && (
            <div className="sm:col-span-2 md:col-span-3 p-2.5 rounded bg-rose-50 border border-rose-200 dark:bg-rose-950 dark:border-rose-900 text-rose-700 dark:text-rose-300">
              <span className="font-semibold block mb-0.5">เหตุผลการคืนสภาพ (Reversed):</span>
              <span>{doc.reversal_reason}</span>
              {doc.reversed_at && (
                <span className="block text-[11px] text-muted-foreground mt-1">
                  ดำเนินการเมื่อ {formatDate(doc.reversed_at)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Items Table Card */}
      <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
        <div className="p-3 border-b border-border bg-muted/30">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            รายการพัสดุ ({doc.items.length} รายการ)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
              <tr>
                <th className="py-2 px-3 text-center w-10">ลำดับ</th>
                <th className="py-2 px-3">รายการพัสดุ / เลขทะเบียน</th>
                <th className="py-2 px-3">หมวดหมู่</th>
                <th className="py-2 px-3 text-right">จำนวนขอเบิก</th>
                <th className="py-2 px-3 text-right">จำนวนจ่ายจริง</th>
                {isBorrow && <th className="py-2 px-3 text-center">คืนแล้ว</th>}
                <th className="py-2 px-3 text-right">ราคา/หน่วย</th>
                {canReturn && <th className="py-2 px-3 text-right">การรับคืน</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {doc.items.map((item, idx) => {
                const itemName = item.item_name_snapshot || '-'
                const assetNo = item.asset_no_snapshot || null
                const unreturned = item.issued_qty - item.returned_qty

                return (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="py-2 px-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <span className="font-medium text-foreground block">{itemName}</span>
                      {assetNo && (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {assetNo} {item.serial_no_snapshot ? `(${item.serial_no_snapshot})` : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{item.category_name_snapshot || '-'}</td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-baseline justify-end gap-1.5 w-full min-w-0 font-mono text-xs">
                        <span className="tabular-nums text-right flex-1 min-w-0 text-foreground">
                          {item.requested_qty}
                        </span>
                        <span
                          className="text-xs font-normal text-muted-foreground truncate w-10 text-left shrink-0"
                          title={item.unit_name_snapshot || undefined}
                        >
                          {item.unit_name_snapshot || ''}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-baseline justify-end gap-1.5 w-full min-w-0 font-mono font-medium text-xs">
                        <span className="tabular-nums text-right flex-1 min-w-0 text-foreground">
                          {item.issued_qty}
                        </span>
                        <span
                          className="text-xs font-normal text-muted-foreground truncate w-10 text-left shrink-0"
                          title={item.unit_name_snapshot || undefined}
                        >
                          {item.unit_name_snapshot || ''}
                        </span>
                      </div>
                    </td>
                    {isBorrow && (
                      <td className="py-2 px-3 text-center font-mono">
                        <span className={item.returned_qty === item.issued_qty ? 'text-emerald-600 font-bold' : ''}>
                          {item.returned_qty}
                        </span>
                      </td>
                    )}
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                      {item.unit_price_snapshot?.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                    </td>
                    {canReturn && (
                      <td className="py-2 px-3 text-right">
                        {unreturned > 0 ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="secondary"
                            onClick={() => {
                              setActiveReturnLine(item)
                              setReturnQty(unreturned)
                              setReturnModalOpen(true)
                            }}
                            className="gap-1 text-[11px]"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>บันทึกคืน ({unreturned})</span>
                          </Button>
                        ) : (
                          <span className="text-emerald-600 text-[11px] font-medium">คืนครบแล้ว</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmDialog
        open={confirmModalOpen}
        onCancel={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirm}
        isPending={isLoading}
        title="ยืนยันการเบิก-จ่ายพัสดุ"
        description="เมื่อยืนยันแล้ว ระบบจะทำการตัดสต็อก หรือเปลี่ยนผู้รับผิดชอบครุภัณฑ์ทันที และจะออกเลขที่เอกสารทางการซึ่งไม่สามารถลบได้ คุณต้องการดำเนินการต่อหรือไม่?"
        confirmText="ยืนยันทำรายการ"
        cancelText="ยกเลิก"
      />

      {/* Cancel Draft Modal */}
      <ConfirmDialog
        open={cancelModalOpen}
        onCancel={() => setCancelModalOpen(false)}
        onConfirm={handleCancelDraft}
        isPending={isLoading}
        variant="destructive"
        title="ยกเลิกเอกสารฉบับร่าง"
        description="คุณต้องการยกเลิกเอกสารฉบับร่างนี้ใช่หรือไม่? เอกสารจะเปลี่ยนสถานะเป็น 'ยกเลิกแล้ว' และไม่สามารถนำกลับมาแก้ไขได้"
        confirmText="ยืนยันยกเลิกร่าง"
        cancelText="ปิด"
      />

      {/* Return Item Modal */}
      {canMutate && returnModalOpen && activeReturnLine && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setReturnModalOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-modal-title"
            onSubmit={handleReturnSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-card text-card-foreground border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 text-xs"
          >
            <h3 id="return-modal-title" className="text-sm font-bold flex items-center gap-2 text-foreground">
              <RotateCcw className="h-4 w-4 text-primary" />
              <span>บันทึกรับคืนครุภัณฑ์</span>
            </h3>
            <p className="text-muted-foreground text-[11px]">
              รายการ: <strong className="text-foreground">{activeReturnLine.item_name_snapshot}</strong>
            </p>

            <div>
              <label htmlFor="return-quantity-input" className="block font-medium mb-1 text-foreground">
                จำนวนที่ต้องการคืน (คงเหลือ: {activeReturnLine.issued_qty - activeReturnLine.returned_qty})
              </label>
              <input
                id="return-quantity-input"
                type="number"
                min="1"
                max={activeReturnLine.issued_qty - activeReturnLine.returned_qty}
                value={returnQty}
                onChange={(e) => setReturnQty(Number(e.target.value))}
                required
                className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="return-condition-select" className="block font-medium mb-1 text-foreground">
                สภาพครุภัณฑ์
              </label>
              <select
                id="return-condition-select"
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value as ItemCondition)}
                className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="normal">ปกติ / พร้อมใช้งาน</option>
                <option value="damaged">ชำรุด / ต้องส่งซ่อม</option>
                <option value="lost">สูญหาย</option>
              </select>
            </div>

            <div>
              <label htmlFor="return-note-input" className="block font-medium mb-1 text-foreground">
                หมายเหตุการคืน (ถ้ามี)
              </label>
              <input
                id="return-note-input"
                type="text"
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                placeholder="เช่น ส่งคืนห้องพัสดุครบถ้วน"
                className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReturnModalOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isLoading}
              >
                {isLoading ? 'กำลังบันทึก...' : 'บันทึกรับคืน'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Reverse Disbursement Modal */}
      {reverseModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setReverseModalOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="reverse-modal-title"
            onSubmit={handleReverseSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-card text-card-foreground border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 text-xs"
          >
            <h3 id="reverse-modal-title" className="text-sm font-bold flex items-center gap-2 text-destructive">
              <Undo2 className="h-4 w-4" />
              <span>คืนสภาพเอกสาร (Reversal)</span>
            </h3>
            <p className="text-muted-foreground text-[11px]">
              การคืนสภาพจะทำการคืนยอดสต็อกพัสดุ หรือคืนผู้รับผิดชอบครุภัณฑ์กลับสู่สถานะเดิมก่อนออกเอกสาร
              รายการนี้จะไม่ถูกลบออกจากระบบ แต่จะถูกบันทึกประวัติการคืนสภาพ
            </p>

            <div>
              <label htmlFor="reverse-reason-textarea" className="block font-medium mb-1 text-foreground">
                เหตุผลการคืนสภาพ <span className="text-destructive">*</span>
              </label>
              <textarea
                id="reverse-reason-textarea"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="ระบุเหตุผลความจำเป็นในการยกเลิกและคืนสภาพ"
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
                onClick={() => setReverseModalOpen(false)}
              >
                ปิด
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={isLoading}
              >
                {isLoading ? 'กำลังประมวลผล...' : 'ยืนยันคืนสภาพ'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Borrow Request Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleRejectSubmit()
            }}
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg space-y-4"
          >
            <div className="flex items-center gap-2 text-destructive border-b border-border pb-3">
              <XCircle className="h-5 w-5" />
              <h3 className="font-bold text-sm text-foreground">ปฏิเสธคำขอยืมพัสดุ</h3>
            </div>

            <div>
              <label htmlFor="reject-reason-textarea" className="block text-xs font-medium mb-1.5 text-foreground">
                ระบุเหตุผลในการไม่อนุมัติ <span className="text-destructive">*</span>
              </label>
              <textarea
                id="reject-reason-textarea"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="เช่น พัสดุติดภารกิจจัดนิทรรศการในวันดังกล่าว หรือต้องส่งซ่อมบำรุง"
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
                disabled={isLoading}
              >
                {isLoading ? 'กำลังประมวลผล...' : 'ยืนยันปฏิเสธ'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
