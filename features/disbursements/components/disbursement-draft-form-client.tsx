'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
} from 'lucide-react'
import { createDisbursementDraft, updateDisbursementDraft } from '@/features/disbursements/actions'
import type {
  DisbursementRow,
  DisbursementItemRow,
  DisbursementTransactionType,
  DisbursementSelectableItem,
} from '@/features/disbursements/types'
import { DisbursementItemPickerModal } from './disbursement-item-picker-modal'

interface DraftFormClientProps {
  initialDoc?: (DisbursementRow & { items: DisbursementItemRow[] }) | null
  availableItems: DisbursementSelectableItem[]
  initialItemIds?: string[]
  initialType?: DisbursementTransactionType
}

export function DisbursementDraftFormClient({
  initialDoc,
  availableItems,
  initialItemIds = [],
  initialType,
}: DraftFormClientProps) {
  const router = useRouter()
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
      if (firstItem?.item_type === 'asset') {
        return firstItem.asset_no ? 'asset_borrow' : 'asset_handover'
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

    setIsSubmitting(true)

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
    }
  }

  const totalRequestedQty = selectedItems.reduce((acc, it) => acc + it.requested_qty, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/disbursements"
            className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-500" />
            <span>{isEditing ? 'แก้ไขเอกสารฉบับร่าง' : 'สร้างเอกสารเบิก-จ่ายใหม่'}</span>
          </h1>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Document Metadata Card */}
        <div className="p-4 rounded-lg border border-border bg-card shadow-xs space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            ข้อมูลทั่วไปของเอกสาร
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Transaction Type */}
            <div>
              <label className="block font-medium text-foreground mb-1">ประเภทการทำรายการ</label>
              <select
                value={transactionType}
                onChange={(e) => {
                  setTransactionType(e.target.value as DisbursementTransactionType)
                  setSelectedItems([]) // reset selected items when type changes
                }}
                disabled={isEditing}
                className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value="material_issue">เบิกจ่ายพัสดุ (ตัดยอดสต็อกถาวร)</option>
                <option value="asset_handover">ส่งมอบครุภัณฑ์ (โอนผู้ถือครองถาวร)</option>
                <option value="asset_borrow">ยืมครุภัณฑ์ (มีกำหนดส่งคืน)</option>
              </select>
            </div>

            {/* Due Date (for borrow only) */}
            {transactionType === 'asset_borrow' ? (
              <div>
                <label className="block font-medium text-foreground mb-1">กำหนดส่งคืน (Due Date)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            ) : <div />}

            {/* Recipient */}
            <div>
              <label className="block font-medium text-foreground mb-1">ชื่อผู้รับพัสดุ / ผู้ยืม</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="เช่น นายสมชาย สายตรวจ"
                required
                className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block font-medium text-foreground mb-1">กลุ่มงาน</label>
              <input
                type="text"
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                placeholder="เช่น กลุ่มงานบริหารจัดการ / กลุ่มงานสารสนเทศ"
                required
                className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Purpose */}
            <div className="sm:col-span-2">
              <label className="block font-medium text-foreground mb-1">วัตถุประสงค์การใช้งาน</label>
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="ระบุเหตุผลความจำเป็นในการเบิกจ่ายหรือยืมใช้งาน"
                rows={2}
                required
                className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Line Items Card */}
        <div className="p-4 rounded-lg border border-border bg-card shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  รายการพัสดุที่ขอเบิก
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
                {transactionType === 'asset_borrow' && 'เฉพาะครุภัณฑ์ที่มีเลขทะเบียนครุภัณฑ์ (ยืมครั้งละ 1 หน่วย)'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllItems}
                  className="px-2.5 py-1.5 rounded-md text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer"
                >
                  ล้างทั้งหมด
                </button>
              )}

              {/* Primary Action: Open Item Picker Modal Table */}
              <button
                type="button"
                onClick={() => setIsPickerModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" />
                <span>
                  {transactionType === 'material_issue'
                    ? 'ค้นหาและเลือกพัสดุจากคลัง'
                    : 'ค้นหาและเลือกครุภัณฑ์จากคลัง'}
                </span>
              </button>
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
              <button
                type="button"
                onClick={() => setIsPickerModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" />
                <span>
                  {transactionType === 'material_issue'
                    ? 'เปิดตารางเลือกพัสดุ'
                    : 'เปิดตารางเลือกครุภัณฑ์'}
                </span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
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
                            <span className="font-semibold text-foreground">
                              {currentItem?.item_name || 'ไม่พบข้อมูลสิ่งของ'}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
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
                            </div>
                          </div>
                        </td>

                        {/* Stock Balance */}
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={`font-mono font-medium px-2 py-0.5 rounded text-[11px] ${
                              (currentItem?.quantity ?? 0) <= 0
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            {currentItem?.quantity ?? 0} {currentItem?.unit?.name || 'หน่วย'}
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
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(idx, selected.requested_qty - 1)}
                                  disabled={selected.requested_qty <= 1}
                                  className="p-1 rounded border border-input hover:bg-muted disabled:opacity-30 transition-colors"
                                  title="ลดจำนวน"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  max={currentItem?.quantity ?? 9999}
                                  value={selected.requested_qty}
                                  onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                                  className="w-16 px-1.5 py-0.5 rounded border border-input bg-background text-center text-xs font-mono font-semibold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(idx, selected.requested_qty + 1)}
                                  disabled={
                                    Boolean(currentItem && selected.requested_qty >= currentItem.quantity)
                                  }
                                  className="p-1 rounded border border-input hover:bg-muted disabled:opacity-30 transition-colors"
                                  title="เพิ่มจำนวน"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                                <span className="text-[11px] text-muted-foreground ml-1">
                                  {currentItem?.unit?.name || 'หน่วย'}
                                </span>
                              </div>
                            )}

                            {isOverStock && (
                              <span className="text-[10px] text-rose-600 font-medium">
                                เกินสต็อก (มี {currentItem?.quantity})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Remove Action */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer"
                            title="ลบรายการนี้"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
        <div className="flex items-center justify-end gap-2 pt-2">
          <Link
            href="/disbursements"
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            ยกเลิก
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกฉบับร่าง'}</span>
          </button>
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
