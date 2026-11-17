'use client'

import { Edit, Tag, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const actionButtonClassName = 'h-8.5 gap-1.5 rounded-lg px-3 text-xs font-semibold cursor-pointer bg-card hover:bg-accent text-card-foreground border-input'

export interface ItemsBulkBarProps {
  onEdit?: () => void
  selectedCount: number
  userCanWrite: boolean
  userCanDelete: boolean
  canPrintBatch: boolean
  showPrintButton: boolean
  onBatchPrint: () => void
  onBulkDelete: () => void
  onClearSelection: () => void
}

export function ItemsBulkBar({
  onEdit,
  selectedCount,
  userCanWrite,
  userCanDelete,
  canPrintBatch,
  showPrintButton,
  onBatchPrint,
  onBulkDelete,
  onClearSelection,
}: ItemsBulkBarProps) {
  if (selectedCount === 0) return null

  return (
    <div role="region" aria-label="จัดการรายการที่เลือก" className="fixed bottom-6 md:bottom-8 left-1/2 z-40 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 flex flex-wrap items-center justify-center gap-2.5 rounded-2xl border border-border bg-card/95 backdrop-blur-md px-5 py-2.5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 text-card-foreground">
      <span className="text-xs font-bold text-card-foreground">
        เลือกอยู่ <span className="text-primary font-black">{selectedCount}</span> รายการ
      </span>

      <div className="h-4 w-px bg-border" />

      {/* Bulk Print Asset Tag */}
      {userCanWrite && showPrintButton && (
        <Button
          disabled={!canPrintBatch}
          title={!canPrintBatch ? 'ต้องโหลดข้อมูลรายการที่เลือกให้ครบก่อนพิมพ์ลาเบล' : undefined}
          onClick={onBatchPrint}
          variant="outline"
          className={actionButtonClassName}
        >
          <Tag className="size-3.5" />
          <span>พิมพ์ลาเบล ({selectedCount})</span>
        </Button>
      )}

      {userCanWrite && (
        <Button variant="outline" className={actionButtonClassName} disabled={!onEdit} title={!onEdit ? 'เลือกรายการเดียวเพื่อแก้ไขข้อมูล' : undefined} onClick={onEdit}>
          <Edit className="size-3.5" />แก้ไขข้อมูล
        </Button>
      )}

      {userCanDelete && (
        <Button
          onClick={onBulkDelete}
          variant="outline"
          className={`${actionButtonClassName} text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30`}
        >
          <Trash2 className="size-3.5" />
          ยกเลิก
        </Button>
      )}

      <div className="h-4 w-px bg-border" />

      {/* Clear Selection */}
      <Button
        variant="outline"
        onClick={onClearSelection}
        className="h-8.5 w-8.5 rounded-lg p-0 cursor-pointer"
        aria-label="ปิดแถบรายการที่เลือก"
        title="ปิด"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
