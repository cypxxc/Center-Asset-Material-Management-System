'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Search,
  X,
  Check,
  Package,
  CheckSquare,
  Square,
} from 'lucide-react'
import type { DisbursementTransactionType, DisbursementSelectableItem } from '@/features/disbursements/types'

interface DisbursementItemPickerModalProps {
  open: boolean
  onClose: () => void
  onSelectItems: (itemIds: string[]) => void
  transactionType: DisbursementTransactionType
  availableItems: DisbursementSelectableItem[]
  alreadySelectedIds: string[]
}

export function DisbursementItemPickerModal({
  open,
  onClose,
  onSelectItems,
  transactionType,
  availableItems,
  alreadySelectedIds,
}: DisbursementItemPickerModalProps) {
  if (!open) return null

  return (
    <DisbursementItemPickerModalContent
      key={transactionType}
      open={open}
      onClose={onClose}
      onSelectItems={onSelectItems}
      transactionType={transactionType}
      availableItems={availableItems}
      alreadySelectedIds={alreadySelectedIds}
    />
  )
}

function DisbursementItemPickerModalContent({
  onClose,
  onSelectItems,
  transactionType,
  availableItems,
  alreadySelectedIds,
}: DisbursementItemPickerModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [hideOutOfStock, setHideOutOfStock] = useState<boolean>(transactionType === 'material_issue')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const dialogRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Focus input and ESC key handler
  useEffect(() => {
    searchInputRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])


  // Extract unique categories from items
  const categories = useMemo(() => {
    const map = new Map<string, string>()
    availableItems.forEach((it) => {
      if (it.category?.id && it.category?.name) {
        map.set(it.category.id, it.category.name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [availableItems])

  // Filter items matching the transaction type first
  const typeEligibleItems = useMemo(() => {
    return availableItems.filter((it) => {
      if (transactionType === 'material_issue') {
        return it.item_type === 'material'
      }
      if (transactionType === 'asset_borrow') {
        return it.item_type === 'asset' && Boolean(it.asset_no?.trim())
      }
      return it.item_type === 'asset'
    })
  }, [availableItems, transactionType])

  // Apply search, category filter, and out-of-stock toggle
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return typeEligibleItems.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category?.id !== selectedCategory) {
        return false
      }

      // Out-of-stock toggle (mainly for materials)
      if (hideOutOfStock && item.quantity <= 0) {
        return false
      }

      // Search term
      if (!term) return true

      const nameMatch = item.item_name.toLowerCase().includes(term)
      const assetMatch = item.asset_no ? item.asset_no.toLowerCase().includes(term) : false
      const serialMatch = item.serial_no ? item.serial_no.toLowerCase().includes(term) : false
      const catMatch = item.category?.name ? item.category.name.toLowerCase().includes(term) : false

      return nameMatch || assetMatch || serialMatch || catMatch
    })
  }, [typeEligibleItems, searchTerm, selectedCategory, hideOutOfStock])

  // Eligible un-added items for "Select All"
  const selectableVisibleItems = useMemo(() => {
    const alreadySet = new Set(alreadySelectedIds)
    return filteredItems.filter((it) => !alreadySet.has(it.id))
  }, [filteredItems, alreadySelectedIds])

  const allVisibleSelected =
    selectableVisibleItems.length > 0 &&
    selectableVisibleItems.every((it) => selectedIds.has(it.id))

  function handleToggleItem(id: string) {
    if (alreadySelectedIds.includes(id)) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleToggleSelectAll() {
    if (allVisibleSelected) {
      // Deselect visible selectable items
      setSelectedIds((prev) => {
        const next = new Set(prev)
        selectableVisibleItems.forEach((it) => next.delete(it.id))
        return next
      })
    } else {
      // Select all visible selectable items
      setSelectedIds((prev) => {
        const next = new Set(prev)
        selectableVisibleItems.forEach((it) => next.add(it.id))
        return next
      })
    }
  }

  function handleConfirm() {
    if (selectedIds.size === 0) return
    onSelectItems(Array.from(selectedIds))
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-picker-title"
        className="w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="item-picker-title" className="text-sm font-bold text-foreground">
                  {transactionType === 'material_issue' ? 'เลือกพัสดุจากคลัง' : 'เลือกครุภัณฑ์จากคลัง'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-secondary-foreground">
                  {transactionType === 'material_issue' && 'พัสดุสิ้นเปลือง'}
                  {transactionType === 'asset_handover' && 'ครุภัณฑ์ (ส่งมอบ)'}
                  {transactionType === 'asset_borrow' && 'ครุภัณฑ์ (ยืมใช้งาน)'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {transactionType === 'material_issue'
                  ? 'ค้นหาและเลือกพัสดุที่ต้องการนำเข้าเอกสารเบิกจ่าย'
                  : 'ค้นหาและเลือกครุภัณฑ์ที่ต้องการนำเข้าเอกสาร'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar: Search & Filters */}
        <div className="p-3 sm:p-4 border-b border-border bg-background/50 space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาชื่อพัสดุ, รหัสครุภัณฑ์, Serial Number หรือหมวดหมู่..."
                className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 p-0.5 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            {categories.length > 0 && (
              <div className="w-full sm:w-48 shrink-0">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                >
                  <option value="all">ทุกหมวดหมู่ ({typeEligibleItems.length})</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Quick Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideOutOfStock}
                  onChange={(e) => setHideOutOfStock(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                />
                <span className="text-[11px]">ซ่อนรายการที่หมดสต็อก (คงเหลือ 0)</span>
              </label>

              <span className="text-muted-foreground text-[11px]">
                พบ <strong>{filteredItems.length}</strong> รายการ
              </span>
            </div>

            {selectableVisibleItems.length > 0 && (
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              >
                {allVisibleSelected ? (
                  <>
                    <CheckSquare className="h-3.5 w-3.5" />
                    <span>ยกเลิกการเลือกทั้งหมด ({selectableVisibleItems.length})</span>
                  </>
                ) : (
                  <>
                    <Square className="h-3.5 w-3.5" />
                    <span>เลือกทั้งหมดที่แสดง ({selectableVisibleItems.length})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Items Data Table */}
        <div className="flex-1 overflow-y-auto min-h-[240px] max-h-[460px]">
          {filteredItems.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-xs font-semibold text-foreground">ไม่พบพัสดุที่ตรงกับเงื่อนไขการค้นหา</p>
              <p className="text-[11px] text-muted-foreground">
                ลองปรับคำค้นหา หรือปิดตัวกรอง &quot;ซ่อนรายการที่หมดสต็อก&quot;
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-xs border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-3 w-10 text-center">เลือก</th>
                  <th className="py-2 px-3 w-32">รหัส / เลขครุภัณฑ์</th>
                  <th className="py-2 px-3">ชื่อรายการพัสดุ</th>
                  <th className="py-2 px-3 w-28">หมวดหมู่</th>
                  <th className="py-2 px-3 w-28 text-right">คงเหลือในคลัง</th>
                  <th className="py-2 px-3 w-20 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item) => {
                  const isAlreadyAdded = alreadySelectedIds.includes(item.id)
                  const isSelected = selectedIds.has(item.id)
                  const isOutOfStock = item.quantity <= 0

                  return (
                    <tr
                      key={item.id}
                      onClick={() => !isAlreadyAdded && handleToggleItem(item.id)}
                      className={`transition-colors select-none ${
                        isAlreadyAdded
                          ? 'bg-muted/30 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-primary/10 hover:bg-primary/15 cursor-pointer font-medium'
                          : 'hover:bg-muted/40 cursor-pointer'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isAlreadyAdded || isSelected}
                          disabled={isAlreadyAdded}
                          onChange={() => handleToggleItem(item.id)}
                          className="rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* Asset / Code */}
                      <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">
                        {item.asset_no || item.serial_no || '-'}
                      </td>

                      {/* Item Name */}
                      <td className="py-2 px-3">
                        <div className="flex flex-col">
                          <span className="text-foreground">{item.item_name}</span>
                          {item.serial_no && item.asset_no && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              S/N: {item.serial_no}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-2 px-3 text-[11px] text-muted-foreground truncate max-w-[120px]">
                        {item.category?.name || '-'}
                      </td>

                      {/* Stock Quantity */}
                      <td className="py-2 px-3 text-right">
                        <span
                          className={`font-mono font-semibold px-2 py-0.5 rounded text-[11px] ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}
                        >
                          {item.quantity} {item.unit?.name || 'หน่วย'}
                        </span>
                      </td>

                      {/* Status / Action */}
                      <td className="py-2 px-3 text-center">
                        {isAlreadyAdded ? (
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            เพิ่มแล้ว
                          </span>
                        ) : isSelected ? (
                          <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                            <Check className="h-3 w-3" />
                            เลือกแล้ว
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground hover:text-foreground">
                            คลิกเลือก
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-border bg-muted/40">
          <div className="text-xs">
            <span className="text-muted-foreground">เลือกรายการใหม่: </span>
            <strong className="text-foreground font-mono">{selectedIds.size}</strong>
            <span className="text-muted-foreground"> รายการ</span>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="ml-3 text-[11px] text-rose-600 hover:underline cursor-pointer"
              >
                ล้างที่เลือก
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors shadow-xs cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>
                {transactionType === 'material_issue'
                  ? `เพิ่มเข้ารายการเบิก (${selectedIds.size})`
                  : transactionType === 'asset_borrow'
                    ? `เพิ่มเข้ารายการยืม (${selectedIds.size})`
                    : `เพิ่มเข้ารายการส่งมอบ (${selectedIds.size})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
