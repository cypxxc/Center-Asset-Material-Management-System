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
} from 'lucide-react'
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

  const isDraft = doc.status === 'draft'
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
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/disbursements"
            className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-500" />
              <span>{doc.document_no || 'เอกสารฉบับร่าง (ยังไม่ยืนยัน)'}</span>
            </h1>
            <p className="text-[11px] text-muted-foreground">
              สร้างเมื่อ {formatDate(doc.created_at)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Print Button (Available for confirmed/terminal docs) */}
          {!isDraft && (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-muted text-foreground transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-blue-500" />
              <span>พิมพ์ใบเบิก-จ่าย (A4)</span>
            </button>
          )}

          {canMutate && isDraft && (
            <>
              <Link
                href={`/disbursements/${doc.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-muted text-foreground transition-colors shadow-xs"
              >
                <span>แก้ไขร่าง</span>
              </Link>

              <button
                type="button"
                onClick={() => setCancelModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>ยกเลิกร่าง</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>ยืนยันการเบิก-จ่าย</span>
              </button>
            </>
          )}

          {canMutate && canReverse && (
            <button
              type="button"
              onClick={() => setReverseModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950 transition-colors cursor-pointer"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>คืนสภาพเอกสาร (Reverse)</span>
            </button>
          )}
        </div>
      </div>

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
                <th className="py-2 px-3 text-center">จำนวนขอเบิก</th>
                <th className="py-2 px-3 text-center">จำนวนจ่ายจริง</th>
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
                    <td className="py-2 px-3 text-center font-mono">
                      {item.requested_qty} {item.unit_name_snapshot || ''}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-medium">
                      {item.issued_qty} {item.unit_name_snapshot || ''}
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
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReturnLine(item)
                              setReturnQty(unreturned)
                              setReturnModalOpen(true)
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>บันทึกคืน ({unreturned})</span>
                          </button>
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
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card text-card-foreground border border-border rounded-lg max-w-md w-full p-4 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>ยืนยันการเบิก-จ่ายพัสดุ</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              เมื่อยืนยันแล้ว ระบบจะทำการตัดสต็อก หรือเปลี่ยนผู้รับผิดชอบครุภัณฑ์ทันที
              และจะออกเลขที่เอกสารทางการซึ่งไม่สามารถลบได้ คุณต้องการดำเนินการต่อหรือไม่?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-muted cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleConfirm}
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? 'กำลังประมวลผล...' : 'ยืนยันทำรายการ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Draft Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card text-card-foreground border border-border rounded-lg max-w-md w-full p-4 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold flex items-center gap-2 text-rose-600">
              <XCircle className="h-4 w-4" />
              <span>ยกเลิกเอกสารฉบับร่าง</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              คุณต้องการยกเลิกเอกสารฉบับร่างนี้ใช่หรือไม่? เอกสารจะเปลี่ยนสถานะเป็น &quot;ยกเลิกแล้ว&quot;
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-muted cursor-pointer"
              >
                ปิด
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleCancelDraft}
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิกร่าง'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Item Modal */}
      {canMutate && returnModalOpen && activeReturnLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleReturnSubmit}
            className="bg-card text-card-foreground border border-border rounded-lg max-w-md w-full p-4 space-y-3 shadow-xl text-xs"
          >
            <h3 className="text-sm font-bold flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-blue-500" />
              <span>บันทึกรับคืนครุภัณฑ์</span>
            </h3>
            <p className="text-muted-foreground text-[11px]">
              รายการ: <strong className="text-foreground">{activeReturnLine.item_name_snapshot}</strong>
            </p>

            <div>
              <label className="block font-medium mb-1">
                จำนวนที่ต้องการคืน (คงเหลือ: {activeReturnLine.issued_qty - activeReturnLine.returned_qty})
              </label>
              <input
                type="number"
                min="1"
                max={activeReturnLine.issued_qty - activeReturnLine.returned_qty}
                value={returnQty}
                onChange={(e) => setReturnQty(Number(e.target.value))}
                required
                className="w-full px-2.5 py-1.5 rounded border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">สภาพครุภัณฑ์</label>
              <select
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value as ItemCondition)}
                className="w-full px-2.5 py-1.5 rounded border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="normal">ปกติ / พร้อมใช้งาน</option>
                <option value="damaged">ชำรุด / ต้องส่งซ่อม</option>
                <option value="lost">สูญหาย</option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1">หมายเหตุการคืน (ถ้ามี)</label>
              <input
                type="text"
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                placeholder="เช่น ส่งคืนห้องพัสดุครบถ้วน"
                className="w-full px-2.5 py-1.5 rounded border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                className="px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-3.5 py-1.5 rounded-md font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? 'กำลังบันทึก...' : 'บันทึกรับคืน'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reverse Disbursement Modal */}
      {reverseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleReverseSubmit}
            className="bg-card text-card-foreground border border-border rounded-lg max-w-md w-full p-4 space-y-3 shadow-xl text-xs"
          >
            <h3 className="text-sm font-bold flex items-center gap-2 text-rose-600">
              <Undo2 className="h-4 w-4" />
              <span>คืนสภาพเอกสาร (Reversal)</span>
            </h3>
            <p className="text-muted-foreground text-[11px]">
              การคืนสภาพจะทำการคืนยอดสต็อกพัสดุ หรือคืนผู้รับผิดชอบครุภัณฑ์กลับสู่สถานะเดิมก่อนออกเอกสาร
              รายการนี้จะไม่ถูกลบออกจากระบบ แต่จะถูกบันทึกประวัติการคืนสภาพ
            </p>

            <div>
              <label className="block font-medium mb-1 text-foreground">
                เหตุผลการคืนสภาพ <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="ระบุเหตุผลความจำเป็นในการยกเลิกและคืนสภาพ"
                rows={3}
                required
                className="w-full px-2.5 py-1.5 rounded border border-input bg-background text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReverseModalOpen(false)}
                className="px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted cursor-pointer"
              >
                ปิด
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-3.5 py-1.5 rounded-md font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? 'กำลังประมวลผล...' : 'ยืนยันคืนสภาพ'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
