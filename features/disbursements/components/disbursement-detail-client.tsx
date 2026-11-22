'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
 ArrowLeft,
 CheckCircle2,
 XCircle,
 RotateCcw,
 Undo2,
 Calendar,
 User,
 AlertTriangle,
 FileText,
 Clock,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { formatDate } from '@/lib/date'
import { bangkokCalendarDate, borrowDueDateError } from '../borrow-dates'
import type { DisbursementRow, DisbursementItemRow, ItemCondition } from '@/features/disbursements/types'
import { TruncatedTextTooltip } from '@/components/ui/truncated-text-tooltip'
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
 partialApproveDisbursement,
 partialReturnDisbursement,
} from '@/features/disbursements/actions'
import { generateDisbursementVoucherHtml } from '@/features/disbursements/print-generator'
import { DisbursementTracking } from './tracking-details'
import { MaterialReturnForm } from '@/features/materials/material-return-form'
import { DisbursementReturnModal, type ReturnModalItem } from './disbursement-return-modal'

interface DetailClientProps {
 doc: DisbursementRow & { items: DisbursementItemRow[] }
 canMutate: boolean
 canRequest: boolean
 canWithdraw?: boolean
 materialApprovalSlaHours?: number | null
}

export function DisbursementDetailClient({ doc, canMutate, canRequest, canWithdraw = false, materialApprovalSlaHours = null }: DetailClientProps) {
 const router = useRouter()

 const [isLoading, setIsLoading] = useState(false)
 const [errorMsg, setErrorMsg] = useState('')
 const [successMsg, setSuccessMsg] = useState('')
 const [replacementDueDate, setReplacementDueDate] = useState('')

 // Modals state
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

 // Partial selection & actions state
 const [multiReturnModalOpen, setMultiReturnModalOpen] = useState(false)
 const [returnModalItems] = useState<ReturnModalItem[]>([])

 const isDraft = doc.status === 'draft'
 const isPendingApproval = doc.status === 'pending_approval'
 const isBorrow = doc.transaction_type === 'asset_borrow'
 const needsDueDate = isBorrow && ['draft', 'pending_approval'].includes(doc.status) && (!doc.due_date || doc.due_date < bangkokCalendarDate())
 const canConfirm = canMutate
 const isConfirmedOrActive = ['confirmed', 'active_borrow'].includes(doc.status)
 const canReturn = canMutate && isBorrow && ['active_borrow', 'partially_returned'].includes(doc.status)

 // Reversal is only allowed if confirmed/active and no partial return has taken place
 const hasReturnedItems = doc.items.some((it) => it.returned_qty > 0)
 const canReverse = canMutate && isConfirmedOrActive && !hasReturnedItems

 const outstandingBorrowCount = doc.items.filter((i) => (i.issued_qty - i.returned_qty) > 0).length

 async function handlePartialApproveSubmit(lineId: string) {
   if (!canMutate || !isPendingApproval || isLoading) return
   if (needsDueDate) {
     const dateError = borrowDueDateError(replacementDueDate, doc.created_at)
     if (dateError) { setErrorMsg(dateError); return }
   }
   setIsLoading(true)
   setErrorMsg('')
   try {
     const res = await partialApproveDisbursement({
       disbursement_id: doc.id,
       line_ids: [lineId],
       replacement_due_date: needsDueDate ? replacementDueDate : undefined,
     })
     if (!res.ok) {
       setErrorMsg(res.error || 'เกิดข้อผิดพลาดในการอนุมัติรายการ')
       return
     }
     setSuccessMsg(`อนุมัติสำเร็จ ${res.data?.document_no ? `(เลขที่เอกสาร: ${res.data.document_no})` : ''}`)
     router.refresh()
   } catch (err: unknown) {
     setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอนุมัติรายการ')
   } finally {
     setIsLoading(false)
   }
 }

 async function handleReturnLine(item: DisbursementItemRow) {
   if (!canReturn || isLoading || !item.item_id) return
   setIsLoading(true)
   setErrorMsg('')
   setSuccessMsg('')
   try {
     const result = await partialReturnDisbursement({
       disbursement_id: doc.id,
       items: [{
         line_id: item.id,
         item_id: item.item_id,
         condition: 'normal',
         return_date: bangkokCalendarDate(),
         reason: 'บันทึกจากปุ่มคืนรายรายการ',
       }],
     })
     if (!result.ok) {
       setErrorMsg(result.error || 'บันทึกรับคืนไม่สำเร็จ')
       return
     }
     setSuccessMsg('บันทึกรับคืนสำเร็จ')
     router.refresh()
   } catch {
     setErrorMsg('บันทึกรับคืนไม่สำเร็จ กรุณาลองใหม่')
   } finally {
     setIsLoading(false)
   }
 }

 async function handleOpenAllReturn() {
   const allOutstanding = doc.items
     .filter((i) => (i.issued_qty - i.returned_qty) > 0)
     .map((i) => ({
       line_id: i.id,
       item_id: i.item_id,
       condition: 'normal' as const,
       return_date: bangkokCalendarDate(),
       reason: 'คืนสภาพปกติ',
     }))
   if (allOutstanding.length === 0 || isLoading) {
     setErrorMsg('ไม่มีรายการครุภัณฑ์ที่ค้างคืนในเอกสารนี้')
     return
   }
   setIsLoading(true)
   setErrorMsg('')
   try {
     const result = await partialReturnDisbursement({
       disbursement_id: doc.id,
       items: allOutstanding,
     })
     if (!result.ok) {
       setErrorMsg(result.error || 'บันทึกรับคืนไม่สำเร็จ')
       return
     }
     setSuccessMsg('บันทึกรับคืนสำเร็จ')
     router.refresh()
   } catch {
     setErrorMsg('บันทึกรับคืนไม่สำเร็จ กรุณาลองใหม่')
   } finally {
     setIsLoading(false)
   }
 }

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
 if (needsDueDate) {
 const dateError = borrowDueDateError(replacementDueDate, doc.created_at)
 if (dateError) { setErrorMsg(dateError); return }
 }
 setIsLoading(true)
 setErrorMsg('')
 try {
 const res = await confirmDisbursement(doc.id, needsDueDate ? replacementDueDate : undefined)
 if (!res.ok) {
 setErrorMsg(res.error || 'เกิดข้อผิดพลาดในการยืนยันเอกสาร')
 return
 }
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
 setSuccessMsg(isPendingApproval ? 'ถอนคำขอเรียบร้อยแล้ว' : 'ยกเลิกเอกสารฉบับร่างเรียบร้อยแล้ว')
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
 setSuccessMsg('ปฏิเสธคำขอเรียบร้อยแล้ว')
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
 setSuccessMsg('บันทึกรับคืนวัสดุสำเร็จ')
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
 <Button variant="outline" size="icon-sm" asChild className="mr-1">
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
 <span>พิมพ์ใบเบิก-จ่าย (A4)</span>
 </Button>
 )}

 {(canMutate || canRequest) && isDraft && (
 <>
 <Button variant="outline" size="sm" asChild className="shadow-xs">
 <Link href={`/disbursements/${doc.id}/edit`}>
 <span>แก้ไขร่าง</span>
 </Link>
 </Button>

 <Button
 variant="outline"
 size="sm"
 onClick={() => setCancelModalOpen(true)}
 className="gap-1 shadow-xs"
 >
 <span>ยกเลิกร่าง</span>
 </Button>

 {canConfirm && <Button
 size="sm"
 onClick={handleConfirm}
 disabled={isLoading}
 className="gap-1.5 shadow-xs"
 >
 <span>จ่ายและยืนยัน</span>
 </Button>}
 </>
 )}

 {canWithdraw && isPendingApproval && <Button variant="outline" size="sm" disabled={isLoading} onClick={() => setCancelModalOpen(true)}>ถอนคำขอ</Button>}

 {canMutate && isPendingApproval && (
 <>
 <Button
 variant="destructive"
 size="sm"
 onClick={() => setRejectModalOpen(true)}
 className="gap-1.5 shadow-xs"
 disabled={isLoading}
 >
 <span>ปฏิเสธทั้งหมด</span>
 </Button>

 <Button
 size="sm"
 onClick={handleConfirm}
 disabled={isLoading}
 className="gap-1.5 shadow-xs"
 >
 <span>อนุมัติทั้งหมด</span>
 </Button>
 </>
 )}

 {canReturn && (
 <>
  {outstandingBorrowCount > 0 && (
   <Button
    variant="outline"
    size="sm"
    onClick={handleOpenAllReturn}
    disabled={isLoading}
    className="gap-1.5 shadow-xs"
   >
    <span>รับคืนทั้งหมด ({outstandingBorrowCount})</span>
   </Button>
  )}
 </>
 )}

 {canMutate && canReverse && (
 <Button
 variant="outline"
 size="sm"
 onClick={() => setReverseModalOpen(true)}
 className="gap-1.5 shadow-xs"
 >
 <span>คืนสภาพเอกสาร (Reverse)</span>
 </Button>
 )}
 </div>
 }
 />

 {canConfirm && needsDueDate && <div className="p-4 rounded border border-amber-300 bg-amber-50 text-sm text-foreground">
 <p>กำหนดส่งคืนเดิมพ้นกำหนดแล้ว กรุณาระบุวันใหม่และกดอนุมัติเพื่อยืนยัน</p>
 <label htmlFor="approval-due-date">กำหนดส่งคืนใหม่</label>
 <input id="approval-due-date" type="date" min={bangkokCalendarDate()} value={replacementDueDate} onChange={event => setReplacementDueDate(event.target.value)} disabled={isLoading} className="mt-1 block rounded border border-border bg-background px-3 py-2" />
 </div>}

 {errorMsg && (
 <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
 <AlertTriangle className="h-4 w-4 shrink-0" />
 <span>{errorMsg}</span>
 </div>
 )}

 {successMsg && (
 <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs flex items-center gap-2">
 <CheckCircle2 className="h-4 w-4 shrink-0" />
 <span>{successMsg}</span>
 </div>
 )}

 {isPendingApproval && (
 <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 flex items-start gap-3">
 <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
 <div className="text-xs space-y-1">
 <p className="font-bold text-sm">{isBorrow ? 'คำขอยืมวัสดุกองกลาง' : 'คำขอเบิกวัสดุกองกลาง'} (รอการอนุมัติ)</p>
 <p className="opacity-90">
 {isBorrow ? 'ผู้ขอยืม' : 'ผู้ขอเบิก'}: <strong className="font-semibold">{doc.recipient_name}</strong> ({doc.department_name}) {isBorrow && <>• วันที่ต้องการส่งคืน: <strong className="font-semibold">{doc.due_date ? formatDate(doc.due_date) : '-'}</strong></>}
 </p>
 <p className="opacity-80">วัตถุประสงค์: {doc.purpose}</p>
 </div>
 </div>
 )}

 {doc.status === 'rejected' && (
 <div className="p-4 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 flex items-start gap-3">
 <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
 <div className="text-xs space-y-1">
 <p className="font-bold text-sm">คำขอนี้ไม่ได้รับการอนุมัติ</p>
 <p className="opacity-90">เหตุผล: {doc.reversal_reason || 'ไม่อนุมัติคำขอ'}</p>
 </div>
 </div>
 )}

 <DisbursementTracking doc={doc} canManage={canMutate} slaHours={materialApprovalSlaHours} />

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
 <span className="text-muted-foreground block text-[11px]">ผู้รับวัสดุ / ผู้ยืม</span>
 <span className="font-medium text-foreground">{doc.recipient_name}</span>
 </div>
 </div>

 <div>
 <span className="text-muted-foreground block text-[11px]">กลุ่มงาน</span>
 <span className="font-medium text-foreground">{doc.department_name || '—'}</span>
 </div>

 {isBorrow && doc.due_date && (
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
 <div className="sm:col-span-2 md:col-span-3 p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 ">
 <span className="font-semibold block mb-0.5">{doc.status === 'rejected' ? 'เหตุผลที่ไม่อนุมัติ:' : 'เหตุผลการคืนสภาพ (Reversed):'}</span>
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
 <div className="p-3 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2">
 <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
 รายการวัสดุ-ครุภัณฑ์ ({doc.items.length} รายการ)
 </h2>
 <div className="flex items-center gap-2 text-xs flex-wrap">
 <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
 ทั้งหมด {doc.items.length}
 </span>
 {doc.items.some(i => i.status === 'issued' || i.status === 'returned' || i.status === 'partially_returned') && (
 <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-mono">
 อนุมัติแล้ว {doc.items.filter(i => i.status === 'issued' || i.status === 'returned' || i.status === 'partially_returned').length}
 </span>
 )}
 {doc.items.some(i => i.status === 'reversed') && (
 <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 font-mono">
 ปฏิเสธ {doc.items.filter(i => i.status === 'reversed').length}
 </span>
 )}
 {doc.items.some(i => i.status === 'pending') && (
 <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-mono">
 รออนุมัติ {doc.items.filter(i => i.status === 'pending').length}
 </span>
 )}
 {isBorrow && (
 <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-mono">
 ค้างคืน {outstandingBorrowCount}
 </span>
 )}
 </div>
 </div>

 <div className="overflow-x-auto">
 <table className="table-data-uniform w-full text-left text-xs">
 <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
 <tr>
 <th className="py-2 px-3 text-center w-10">ลำดับ</th>
 <th className="py-2 px-3">รายการวัสดุ / เลขทะเบียน</th>
 <th className="py-2 px-3">หมวดหมู่</th>
 <th className="py-2 px-3 text-center">สถานะรายการ</th>
 <th className="py-2 px-3 text-right">จำนวนขอเบิก</th>
 <th className="py-2 px-3 text-right">จำนวนจ่ายจริง</th>
 {(isBorrow || doc.transaction_type === 'material_issue') && <th className="py-2 px-3 text-center">คืนแล้ว</th>}
 <th className="py-2 px-3 text-right">ราคา/หน่วย</th>
 {canReturn && <th className="py-2 px-3 text-right">คืน</th>}
 {canMutate && doc.transaction_type === 'material_issue' && ['confirmed','partially_returned'].includes(doc.status) && <th className="py-2 px-3 text-right">รับคืนวัสดุ</th>}
 {canMutate && isPendingApproval && <th scope="col" className="py-2 px-3 text-right">จัดการ</th>}
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {doc.items.map((item, idx) => {
 const itemName = item.item_name_snapshot || '-'
 const assetNo = item.asset_no_snapshot || null
 const unreturned = item.issued_qty - item.returned_qty
 const isPending = item.status === 'pending'

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
 <td className="py-2 px-3 text-center">
 {item.status === 'pending' && 'รออนุมัติ'}
 {item.status === 'issued' && 'อนุมัติแล้ว'}
 {item.status === 'reversed' && 'ปฏิเสธ'}
 {item.status === 'partially_returned' && 'คืนบางส่วน'}
 {item.status === 'returned' && 'คืนครบแล้ว'}
 </td>
 <td className="py-2 px-3 text-right">
 <div className="flex items-baseline justify-end gap-1.5 w-full min-w-0 font-mono text-xs">
 <span className="tabular-nums text-right flex-1 min-w-0 text-foreground">
 {item.requested_qty}
 </span>
 {item.unit_name_snapshot ? (
 <TruncatedTextTooltip
 text={item.unit_name_snapshot}
 as="span"
 className="text-xs font-normal text-muted-foreground truncate w-10 text-left shrink-0"
 />
 ) : null}
 </div>
 </td>
 <td className="py-2 px-3 text-right">
 <div className="flex items-baseline justify-end gap-1.5 w-full min-w-0 font-mono font-medium text-xs">
 <span className="tabular-nums text-right flex-1 min-w-0 text-foreground">
 {item.issued_qty}
 </span>
 {item.unit_name_snapshot ? (
 <TruncatedTextTooltip
 text={item.unit_name_snapshot}
 as="span"
 className="text-xs font-normal text-muted-foreground truncate w-10 text-left shrink-0"
 />
 ) : null}
 </div>
 </td>
 {(isBorrow || doc.transaction_type === 'material_issue') && (
 <td className="py-2 px-3 text-center font-mono">
 <span className={item.returned_qty === item.issued_qty ? 'text-emerald-600 font-bold' : ''}>
 {item.returned_qty}
 </span>
 </td>
 )}
 <td className="py-2 px-3 text-right font-mono text-muted-foreground">
 {item.unit_price_snapshot?.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
 </td>
 {canMutate && doc.transaction_type === 'material_issue' && ['confirmed','partially_returned'].includes(doc.status) && <td className="py-2 px-3 text-right"><MaterialReturnForm lineId={item.id} remaining={unreturned} unit={item.unit_name_snapshot} /></td>}
 {canMutate && isPendingApproval && (
 <td className="py-2 px-3 text-right">
 {isPending && (
 <Button type="button" size="xs" disabled={isLoading} onClick={() => handlePartialApproveSubmit(item.id)}>
 อนุมัติ
 </Button>
 )}
 </td>
 )}
 {canReturn && (
 <td className="py-2 px-3 text-right">
 {unreturned > 0 ? (
 <Button
 type="button"
 size="xs"
 variant="outline"
 disabled={isLoading}
 onClick={() => handleReturnLine(item)}
 className="gap-1 text-[11px]"
 >
 <span>คืน ({unreturned})</span>
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

 {/* Cancel Draft Modal */}
 <ConfirmDialog
 open={cancelModalOpen}
 onCancel={() => setCancelModalOpen(false)}
 onConfirm={handleCancelDraft}
 isPending={isLoading}
 variant="destructive"
 title={isPendingApproval ? 'ถอนคำขอ' : 'ยกเลิกเอกสารฉบับร่าง'}
 description={isPendingApproval ? 'ต้องการถอนคำขอนี้ใช่หรือไม่? คำขอจะเปลี่ยนสถานะเป็นยกเลิกแล้ว โดยไม่มีการจ่ายวัสดุ' : "คุณต้องการยกเลิกเอกสารฉบับร่างนี้ใช่หรือไม่? เอกสารจะเปลี่ยนสถานะเป็น 'ยกเลิกแล้ว' และไม่สามารถนำกลับมาแก้ไขได้"}
 confirmText={isPendingApproval ? 'ยืนยันถอนคำขอ' : 'ยืนยันยกเลิกร่าง'}
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
 placeholder="เช่น ส่งคืนห้องวัสดุครบถ้วน"
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
 <Button aria-busy={isLoading}
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
 การคืนสภาพจะทำการคืนยอดสต็อกวัสดุ หรือคืนผู้รับผิดชอบครุภัณฑ์กลับสู่สถานะเดิมก่อนออกเอกสาร
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
 <Button aria-busy={isLoading}
 type="submit"
 variant="outline"
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
 <h3 className="font-bold text-sm text-foreground">ปฏิเสธคำขอวัสดุ</h3>
 </div>

 <div>
 <label htmlFor="reject-reason-textarea" className="block text-xs font-medium mb-1.5 text-foreground">
 ระบุเหตุผลในการไม่อนุมัติ <span className="text-destructive">*</span>
 </label>
 <textarea
 id="reject-reason-textarea"
 value={rejectReason}
 onChange={(e) => setRejectReason(e.target.value)}
 placeholder="เช่น วัสดุติดภารกิจจัดนิทรรศการในวันดังกล่าว หรือต้องส่งซ่อมบำรุง"
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
 <Button aria-busy={isLoading}
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

 {/* Partial Reject Modal */}
 {/* Multi/Partial Return Modal */}
 <DisbursementReturnModal
 disbursementId={doc.id}
 recipientName={doc.recipient_name || '-'}
 items={returnModalItems}
 isOpen={multiReturnModalOpen}
 onClose={() => setMultiReturnModalOpen(false)}
 onSuccess={() => {
 setMultiReturnModalOpen(false)
 router.refresh()
 }}
 />
 </div>
 )
}
