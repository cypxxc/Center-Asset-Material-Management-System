'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Select } from 'radix-ui'
import {
 ArrowLeft,
 Save,
 Trash2,
 Plus,
 Minus,
 AlertCircle,
 FileText,
 Search,
 Package,
 ChevronDown,
 Check,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { FormInput, FormTextarea, FormLabel } from '@/components/ui/form'
import { createDisbursementDraft, updateDisbursementDraft } from '@/features/disbursements/actions'
import type {
 DisbursementRow,
 DisbursementItemRow,
 DisbursementTransactionType,
 DisbursementSelectableItem,
} from '@/features/disbursements/types'
import { DisbursementItemPickerModal } from './disbursement-item-picker-modal'
import { isCentralDisbursementItem } from '../central-items'

interface DraftFormClientProps {
 initialDoc?: (DisbursementRow & { items: DisbursementItemRow[] }) | null
 availableItems: DisbursementSelectableItem[]
 initialItemIds?: string[]
 initialType?: DisbursementTransactionType
 userRole: string
 onCancel?: () => void
 onSubmittingChange?: (pending: boolean) => void
}

export function DisbursementDraftFormClient({
 initialDoc,
 availableItems: allAvailableItems,
 initialItemIds = [],
 initialType,
 userRole,
 onCancel,
 onSubmittingChange,
}: DraftFormClientProps) {
 const router = useRouter()
 const availableItems = allAvailableItems.filter(isCentralDisbursementItem)
 const isEditing = Boolean(initialDoc?.id)

 // Map for fast item lookup
 const itemsMap = new Map(availableItems.map((it) => [it.id, it]))

 // Resolve initial selected items from doc or initialItemIds query param
 const defaultSelected = () => {
 if (initialDoc?.items?.length) {
 return initialDoc.items.map((it) => ({ item_id: it.item_id, requested_qty: it.requested_qty }))
 }
 if (initialItemIds.length > 0) {
 return initialItemIds
 .filter((id) => itemsMap.has(id))
 .map((id) => ({ item_id: id, requested_qty: 1 }))
 }
 return []
 }

 // Deduce transaction type
 const resolveInitialType = (): DisbursementTransactionType => {
 if (initialDoc?.transaction_type) return initialDoc.transaction_type
 if (initialType) return initialType
 if (initialItemIds.length > 0) {
 const firstItem = itemsMap.get(initialItemIds[0])
 if (firstItem?.is_central || (firstItem?.note && firstItem.note.includes('ส่วนกลาง'))) {
 return 'asset_borrow'
 }
 if (firstItem?.item_type === 'asset') {
 return 'asset_handover'
 }
 return 'material_issue'
 }
 return 'material_issue'
 }

 const [transactionType, setTransactionType] = useState<DisbursementTransactionType>(resolveInitialType)
 const [recipientName, setRecipientName] = useState(initialDoc?.recipient_name || '')
 const [departmentName, setDepartmentName] = useState(initialDoc?.department_name || '')
 const [purpose, setPurpose] = useState(initialDoc?.purpose || '')
 const [dueDate, setDueDate] = useState(initialDoc?.due_date || '')

 const [selectedItems, setSelectedItems] = useState<{ item_id: string; requested_qty: number }[]>(defaultSelected)

 const [isPickerModalOpen, setIsPickerModalOpen] = useState(false)
 const [errorMsg, setErrorMsg] = useState('')
 const [isSubmitting, setIsSubmitting] = useState(false)

 function handleAddItemsFromModal(itemIds: string[]) {
 const existingSet = new Set(selectedItems.map((it) => it.item_id))
 const newItems = itemIds
 .filter((id) => !existingSet.has(id))
 .map((id) => ({ item_id: id, requested_qty: 1 }))
 setSelectedItems((prev) => [...prev, ...newItems])
 }

 function handleRemoveItem(index: number) {
 setSelectedItems((prev) => prev.filter((_, i) => i !== index))
 }

 function handleQtyChange(index: number, qty: number) {
 setSelectedItems((prev) =>
 prev.map((item, i) => (i === index ? { ...item, requested_qty: Math.max(1, qty) } : item))
 )
 }

 function handleClearAllItems() {
 setSelectedItems([])
 }

 async function handleSubmit(e: React.FormEvent) {
 e.preventDefault()
 setErrorMsg('')

 if (!recipientName.trim()) {
 setErrorMsg('กรุณาระบุชื่อผู้รับพัสดุ / ผู้ยืม')
 return
 }
 if (!departmentName.trim()) {
 setErrorMsg('กรุณาระบุกลุ่มงาน')
 return
 }
 if (!purpose.trim()) {
 setErrorMsg('กรุณาระบุวัตถุประสงค์การใช้งาน')
 return
 }
 if (transactionType === 'asset_borrow' && !dueDate) {
 setErrorMsg('กรุณาระบุกำหนดส่งคืนสำหรับการยืมครุภัณฑ์')
 return
 }
 if (selectedItems.length === 0) {
 setErrorMsg('ต้องเลือกรายการสิ่งของอย่างน้อย 1 รายการ')
 return
 }

 // Check material stock
 if (transactionType === 'material_issue') {
 for (const selected of selectedItems) {
 const item = itemsMap.get(selected.item_id)
 if (item && selected.requested_qty > item.quantity) {
 setErrorMsg(
 `รายการ "${item.item_name}" ขอเบิก ${selected.requested_qty} ${item.unit?.name || 'หน่วย'} แต่มีสต็อกคงเหลือเพียง ${item.quantity} ${item.unit?.name || 'หน่วย'}`
 )
 return
 }
 }
 }

 // Check central pool restriction for asset borrow
 if (transactionType === 'asset_borrow') {
 for (const selected of selectedItems) {
 const item = itemsMap.get(selected.item_id)
 if (item && !item.is_central && (!item.note || !item.note.includes('ส่วนกลาง'))) {
 setErrorMsg(
 `ไม่สามารถทำรายการได้: "${item.item_name}" ไม่ใช่ของส่วนกลาง (อนุญาตให้ยืมเฉพาะของส่วนกลางเท่านั้น)`
 )
 return
 }
 }
 }

 setIsSubmitting(true)
 onSubmittingChange?.(true)

 try {
 if (isEditing && initialDoc) {
 const res = await updateDisbursementDraft({
 id: initialDoc.id,
 transaction_type: transactionType,
 recipient_name: recipientName,
 department_name: departmentName,
 purpose,
 due_date: dueDate || null,
 items: selectedItems,
 })
 if (!res.ok) {
 setErrorMsg(res.error || 'เกิดข้อผิดพลาดในการบันทึก')
 setIsSubmitting(false)
 return
 }
 router.push(`/disbursements/${initialDoc.id}`)
 } else {
 const res = await createDisbursementDraft({
 transaction_type: transactionType,
 recipient_name: recipientName,
 department_name: departmentName,
 purpose,
 due_date: dueDate || null,
 items: selectedItems,
 })
 if (!res.ok || !res.data) {
 setErrorMsg(res.error || 'เกิดข้อผิดพลาดในการสร้างเอกสาร')
 setIsSubmitting(false)
 return
 }
 router.push(`/disbursements/${res.data.id}`)
 }
 } catch (err: unknown) {
 setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการประมวลผล')
 setIsSubmitting(false)
 } finally {
 onSubmittingChange?.(false)
 }
 }

 const totalRequestedQty = selectedItems.reduce((acc, it) => acc + it.requested_qty, 0)

 return (
 <div className="space-y-5">
 {/* Page Header */}
 {!onCancel && <PageHeader
 title={
 <span className="flex items-center gap-2">
 <Button variant="ghost" size="icon-sm" asChild className="mr-1">
 <Link href="/disbursements" aria-label="กลับไปหน้ารายการ">
 <ArrowLeft className="h-4 w-4" />
 </Link>
 </Button>
 <FileText className="h-5 w-5 text-amber-500 shrink-0" aria-hidden="true" />
 <span>{isEditing ? 'แก้ไขเอกสารฉบับร่าง' : userRole === 'user' ? 'ส่งคำขอเบิกวัสดุ' : 'สร้างเอกสารเบิก-จ่ายใหม่'}</span>
 </span>
 }
 subtitle={
 isEditing
 ? `แก้ไขข้อมูลเอกสาร ${initialDoc?.document_no || 'ฉบับร่าง'}`
 : undefined
 }
 />}

 {errorMsg && (
 <div role="alert" className="p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-2 mb-4">
 <AlertCircle className="h-4 w-4 shrink-0" />
 <span>{errorMsg}</span>
 </div>
 )}

 {/* Main Form */}
 <form onSubmit={handleSubmit} className="space-y-5">
 {/* Document Metadata Card */}
 <div className="overflow-hidden p-4 pt-0 sm:p-5 sm:pt-0 rounded-xl border border-border bg-card space-y-4">
 <div className="-mx-4 sm:-mx-5 flex items-center gap-2 border-b border-blue-200 bg-blue-50 px-4 py-3 text-blue-900 sm:px-5">
 <FileText className="size-4 shrink-0" aria-hidden="true" />
 <h2 className="text-sm font-semibold flex items-center gap-1.5">
 <span>ข้อมูลทั่วไปของเอกสาร</span>
 </h2>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
 {/* Transaction Type */}
 <div>
 <FormLabel htmlFor="disbursement-transaction-type" className="mb-1.5 font-medium">
 ประเภทการทำรายการ <span className="text-destructive">*</span>
 </FormLabel>
 <select
 id="disbursement-transaction-type"
 value={transactionType}
 onChange={(e) => {
 setTransactionType(e.target.value as DisbursementTransactionType)
 setSelectedItems([]) // reset selected items when type changes
 }}
 disabled={isEditing}
 tabIndex={-1}
 className="sr-only"
 >
 <option value="material_issue">เบิกวัสดุ</option>
 {userRole === 'admin' && <option value="asset_handover">ส่งมอบครุภัณฑ์</option>}
 {userRole === 'admin' && <option value="asset_borrow">ยืมของส่วนกลาง</option>}
 </select>
 <Select.Root
 value={transactionType}
 disabled={isEditing}
 onValueChange={(value) => {
 setTransactionType(value as DisbursementTransactionType)
 setSelectedItems([])
 }}
 >
 <Select.Trigger
 aria-label="เลือกประเภทการทำรายการ"
 className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-xs font-normal text-foreground shadow-2xs outline-none transition-colors hover:bg-muted/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
 >
 <Select.Value />
 <Select.Icon><ChevronDown className="size-3.5 text-muted-foreground" /></Select.Icon>
 </Select.Trigger>
 <Select.Portal>
 <Select.Content position="popper" sideOffset={6} className="z-[60] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95">
 <Select.Viewport>
 {[
 { value: 'material_issue', label: 'เบิกวัสดุ' },
 ...(userRole === 'admin' ? [
 { value: 'asset_handover', label: 'ส่งมอบครุภัณฑ์' },
 { value: 'asset_borrow', label: 'ยืมของส่วนกลาง' },
 ] : []),
 ].map((option) => (
 <Select.Item key={option.value} value={option.value} className="relative flex cursor-pointer items-center rounded-lg py-2 pl-3 pr-8 text-xs outline-none transition-colors data-[highlighted]:bg-muted data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary">
 <Select.ItemText>{option.label}</Select.ItemText>
 <Select.ItemIndicator className="absolute right-2.5"><Check className="size-3.5" /></Select.ItemIndicator>
 </Select.Item>
 ))}
 </Select.Viewport>
 </Select.Content>
 </Select.Portal>
 </Select.Root>
 </div>

 {/* Due Date (for borrow only) */}
 {transactionType === 'asset_borrow' ? (
 <div>
 <FormLabel htmlFor="disbursement-due-date" className="mb-1.5 font-medium">
 กำหนดส่งคืน <span className="text-destructive">*</span>
 </FormLabel>
 <FormInput
 id="disbursement-due-date"
 type="date"
 value={dueDate}
 onChange={(e) => setDueDate(e.target.value)}
 required
 />
 </div>
 ) : null}

 {/* Recipient */}
 <div>
 <FormLabel htmlFor="disbursement-recipient-name" className="mb-1.5 font-medium">
 ชื่อผู้รับพัสดุ / ผู้ยืม <span className="text-destructive">*</span>
 </FormLabel>
 <FormInput
 id="disbursement-recipient-name"
 type="text"
 value={recipientName}
 onChange={(e) => setRecipientName(e.target.value)}
 placeholder="เช่น นายสมชาย สายตรวจ"
 required
 />
 </div>

 {/* Department */}
 <div>
 <FormLabel htmlFor="disbursement-department-name" className="mb-1.5 font-medium">
 กลุ่มงาน / สังกัด <span className="text-destructive">*</span>
 </FormLabel>
 <FormInput
 id="disbursement-department-name"
 type="text"
 value={departmentName}
 onChange={(e) => setDepartmentName(e.target.value)}
 placeholder="เช่น กลุ่มงานบริหารจัดการ / กลุ่มงานสารสนเทศ"
 required
 />
 </div>

 {/* Purpose */}
 <div className="sm:col-span-2">
 <FormLabel htmlFor="disbursement-purpose" className="mb-1.5 font-medium">
 วัตถุประสงค์การใช้งาน <span className="text-destructive">*</span>
 </FormLabel>
 <FormTextarea
 id="disbursement-purpose"
 value={purpose}
 onChange={(e) => setPurpose(e.target.value)}
 placeholder="ระบุเหตุผลความจำเป็นในการเบิกจ่ายหรือยืมใช้งาน"
 rows={3}
 required
 />
 </div>
 </div>
 </div>

 {/* Line Items Card */}
 <div className="overflow-hidden p-4 pt-0 sm:p-5 sm:pt-0 rounded-xl border border-border bg-card space-y-4">
 <div className="-mx-4 sm:-mx-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-violet-200 bg-violet-50 px-4 py-3 text-violet-900 sm:px-5">
 <div>
 <div className="flex items-center gap-2">
 <Package className="size-4 shrink-0" aria-hidden="true" />
 <h2 className="text-sm font-semibold">
 รายการ
 </h2>
 {selectedItems.length > 0 && (
 <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
 {selectedItems.length} รายการ
 </span>
 )}
 </div>
 <p className="text-[11px] text-muted-foreground mt-0.5">
 {transactionType === 'material_issue' && 'เฉพาะพัสดุสิ้นเปลือง (สามารถเบิกตามยอดคงเหลือ)'}
 {transactionType === 'asset_handover' && 'เฉพาะครุภัณฑ์ (โอนเปลี่ยนผู้ถือครองถาวร)'}
 {transactionType === 'asset_borrow' && 'เฉพาะรายการของส่วนกลาง (ยืมครั้งละ 1 หน่วย)'}
 </p>
 </div>

 <div className="flex items-center gap-2">
 {selectedItems.length > 0 && (
 <Button
 type="button"
 variant="ghost"
 size="xs"
 onClick={handleClearAllItems}
 className="text-destructive hover:bg-destructive/10"
 >
 ล้างทั้งหมด
 </Button>
 )}

 </div>
 </div>

 {selectedItems.length === 0 ? (
 <div className="p-8 text-center border border-dashed border-border rounded-xl text-xs space-y-3 bg-muted/10">
 <Package className="h-10 w-10 mx-auto text-muted-foreground/40" />
 <div className="space-y-1">
 <p className="font-semibold text-foreground">
 {transactionType === 'material_issue'
 ? 'ยังไม่มีรายการพัสดุในเอกสารนี้'
 : 'ยังไม่มีรายการครุภัณฑ์ในเอกสารนี้'}
 </p>
 <p className="text-[11px] text-muted-foreground">
 กดปุ่ม &quot;{transactionType === 'material_issue' ? 'ค้นหาและเลือกพัสดุจากคลัง' : 'ค้นหาและเลือกครุภัณฑ์จากคลัง'}&quot; เพื่อเปิดตารางค้นหาและเลือกสิ่งของ
 </p>
 </div>
 <Button
 type="button"
 size="sm"
 onClick={() => setIsPickerModalOpen(true)}
 className="h-9 gap-1.5 border border-primary/30 bg-primary/10 text-primary font-normal hover:bg-primary/15"
 >
 <Search className="h-3.5 w-3.5" />
 <span>
 {transactionType === 'material_issue'
 ? 'เปิดตารางเลือกพัสดุ'
 : 'เปิดตารางเลือกครุภัณฑ์'}
 </span>
 </Button>
 </div>
 ) : (
 <div className="overflow-x-auto border border-border rounded-lg">
 <table className="table-data-uniform w-full text-left border-collapse text-xs">
 <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
 <tr>
 <th className="py-2.5 px-3 w-10 text-center">ลำดับ</th>
 <th className="py-2.5 px-3 w-32">รหัส / ทะเบียน</th>
 <th className="py-2.5 px-3">รายการพัสดุ</th>
 <th className="py-2.5 px-3 w-28 text-right">คงเหลือในคลัง</th>
 <th className="py-2.5 px-3 w-36 text-center">จำนวนที่ขอเบิก</th>
 <th className="py-2.5 px-3 w-12 text-center">ลบ</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {selectedItems.map((selected, idx) => {
 const currentItem = itemsMap.get(selected.item_id)
 const isAssetBorrow = transactionType === 'asset_borrow'
 const isAssetHandover = transactionType === 'asset_handover'
 const isOverStock =
 transactionType === 'material_issue' &&
 currentItem &&
 selected.requested_qty > currentItem.quantity

 return (
 <tr key={selected.item_id} className="hover:bg-muted/20 transition-colors">
 {/* Index */}
 <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
 {idx + 1}
 </td>

 {/* Code */}
 <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
 {currentItem?.asset_no || currentItem?.serial_no || '-'}
 </td>

 {/* Item Details */}
 <td className="py-2.5 px-3">
 <div className="flex flex-col">
 <div className="flex items-center gap-1.5 flex-wrap">
 <span className="font-semibold text-foreground">
 {currentItem?.item_name || 'ไม่พบข้อมูลสิ่งของ'}
 </span>
 {(currentItem?.is_central || (currentItem?.note && currentItem.note.includes('ส่วนกลาง'))) && (
 <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-300/40">
 ส่วนกลาง
 </span>
 )}
 {isAssetBorrow && currentItem && !currentItem.is_central && !currentItem.note?.includes('ส่วนกลาง') && (
 <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
 ไม่ใช่ของส่วนกลาง
 </span>
 )}
 </div>
 <div className="flex items-center gap-2 mt-0.5 flex-wrap">
 {currentItem?.category?.name && (
 <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
 {currentItem.category.name}
 </span>
 )}
 {currentItem?.serial_no && currentItem?.asset_no && (
 <span className="text-[10px] text-muted-foreground font-mono">
 S/N: {currentItem.serial_no}
 </span>
 )}
 {currentItem?.note && (
 <span className="text-[10px] text-muted-foreground">
 📝 {currentItem.note}
 </span>
 )}
 </div>
 </div>
 </td>

 {/* Stock Balance */}
 <td className="py-2.5 px-3 text-right">
 <span
 className={`inline-flex items-baseline justify-end gap-1 font-mono font-medium px-2 py-0.5 rounded text-[11px] ${
 (currentItem?.quantity ?? 0) <= 0
 ? 'bg-destructive/10 text-destructive'
 : 'bg-muted text-foreground'
 }`}
 >
 <span className="tabular-nums text-right min-w-[20px]">{currentItem?.quantity ?? 0}</span>
 <span className="font-normal text-[10px] text-muted-foreground truncate max-w-[36px]" title={currentItem?.unit?.name || 'หน่วย'}>
 {currentItem?.unit?.name || 'หน่วย'}
 </span>
 </span>
 </td>

 {/* Requested Quantity with Stepper */}
 <td className="py-2.5 px-3">
 <div className="flex flex-col items-center gap-1">
 {isAssetBorrow || isAssetHandover ? (
 <div className="flex items-center gap-1 text-center">
 <span className="font-mono font-bold text-foreground">1</span>
 <span className="text-[11px] text-muted-foreground">
 {currentItem?.unit?.name || 'หน่วย'}
 </span>
 </div>
 ) : (
 <div className="flex items-center gap-1">
 <Button
 type="button"
 variant="outline"
 size="icon-xs"
 onClick={() => handleQtyChange(idx, selected.requested_qty - 1)}
 disabled={selected.requested_qty <= 1}
 title="ลดจำนวน"
 aria-label={`ลดจำนวน ${currentItem?.item_name || 'รายการ'}`}
 >
 <Minus className="h-3 w-3" />
 </Button>
 <input
 type="number"
 min="1"
 max={currentItem?.quantity ?? 9999}
 value={selected.requested_qty}
 onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
 aria-label={`จำนวนขอเบิก ${currentItem?.item_name || 'รายการ'}`}
 className="w-16 h-6 px-1.5 rounded-md border border-input bg-background text-center text-xs font-mono font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
 />
 <Button
 type="button"
 variant="outline"
 size="icon-xs"
 onClick={() => handleQtyChange(idx, selected.requested_qty + 1)}
 disabled={
 Boolean(currentItem && selected.requested_qty >= currentItem.quantity)
 }
 title="เพิ่มจำนวน"
 aria-label={`เพิ่มจำนวน ${currentItem?.item_name || 'รายการ'}`}
 >
 <Plus className="h-3 w-3" />
 </Button>
 <span className="text-[11px] text-muted-foreground ml-1">
 {currentItem?.unit?.name || 'หน่วย'}
 </span>
 </div>
 )}

 {isOverStock && (
 <span className="text-[10px] text-destructive font-medium">
 เกินสต็อก (มี {currentItem?.quantity})
 </span>
 )}
 </div>
 </td>

 {/* Remove Action */}
 <td className="py-2.5 px-3 text-center">
 <Button
 type="button"
 variant="ghost"
 size="icon-xs"
 onClick={() => handleRemoveItem(idx)}
 className="text-destructive hover:bg-destructive/10"
 title="ลบรายการนี้"
 aria-label={`ลบรายการ ${currentItem?.item_name || ''}`}
 >
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </td>
 </tr>
 )
 })}
 </tbody>
 </table>

 {/* Summary Bar */}
 <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-t border-border text-xs">
 <span className="text-muted-foreground">
 รวมทั้งหมด: <strong className="text-foreground">{selectedItems.length}</strong> รายการ
 </span>
 <span className="font-semibold text-foreground">
 จำนวนขอเบิกรวม:{' '}
 <span className="font-mono text-primary text-sm font-bold">
 {totalRequestedQty}
 </span>{' '}
 หน่วย
 </span>
 </div>
 </div>
 )}
 </div>

 {/* Action Buttons */}
 <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-6">
 {onCancel ? (
 <Button type="button" variant="outline" size="sm" className="h-9 px-4 font-normal" onClick={onCancel} disabled={isSubmitting}>ยกเลิก</Button>
 ) : <Button variant="outline" size="sm" asChild>
 <Link href="/disbursements">
 ยกเลิก
 </Link>
 </Button>}
 <Button
 type="submit"
 size="sm"
 disabled={isSubmitting}
 className="h-9 gap-1.5 border border-primary/30 bg-primary/10 px-4 text-primary font-normal hover:bg-primary/15"
 >
 <Save className="h-4 w-4" />
 <span>{isSubmitting ? 'กำลังบันทึก...' : userRole === 'user' ? 'ส่งคำขอเบิก' : 'บันทึกฉบับร่าง'}</span>
 </Button>
 </div>
 </form>

 {/* Item Picker Modal */}
 <DisbursementItemPickerModal
 open={isPickerModalOpen}
 onClose={() => setIsPickerModalOpen(false)}
 onSelectItems={handleAddItemsFromModal}
 transactionType={transactionType}
 availableItems={availableItems}
 alreadySelectedIds={selectedItems.map((it) => it.item_id)}
 />
 </div>
 )
}
