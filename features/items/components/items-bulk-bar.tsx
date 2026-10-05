'use client'

import { Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface ItemsBulkBarProps {
  selectedCount: number
  total: number
  userCanWrite: boolean
  userCanDelete: boolean
  selectingAll: boolean
  canPrintBatch: boolean
  onBulkEdit: () => void
  onSelectAllMatching: () => void
  onBatchPrint: () => void
  onBulkDelete: () => void
  onClearSelection: () => void
}

export function ItemsBulkBar({
  selectedCount,
  total,
  userCanWrite,
  userCanDelete,
  selectingAll,
  canPrintBatch,
  onBulkEdit,
  onSelectAllMatching,
  onBatchPrint,
  onBulkDelete,
  onClearSelection,
}: ItemsBulkBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-14 left-1/2 z-40 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur-md px-5 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 text-card-foreground">
      <span className="text-xs font-bold text-card-foreground">
        เลือกอยู่ <span className="text-primary font-black">{selectedCount}</span> รายการ
      </span>

      <div className="h-4 w-px bg-border" />

      {userCanWrite && (
        <>
          <Button
            id="bulk-edit-trigger"
            disabled={selectingAll}
            onClick={onBulkEdit}
            className="h-9 text-sm"
          >
            แก้ไขหลายรายการ
          </Button>
          <Button
            variant="outline"
            disabled={selectingAll}
            onClick={onSelectAllMatching}
            className="h-9 text-sm"
          >
            {selectingAll ? 'กำลังเลือก...' : `เลือกทั้งหมดตามผลค้นหา (${total})`}
          </Button>
        </>
      )}

      {/* Bulk Print Asset Tag */}
      <Button
        disabled={!canPrintBatch}
        title={!canPrintBatch ? 'ต้องโหลดข้อมูลรายการที่เลือกให้ครบก่อนพิมพ์ลาเบล' : undefined}
        onClick={onBatchPrint}
        variant="outline"
        className="h-8 rounded-lg px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-card hover:bg-accent text-card-foreground border-input"
      >
        <Tag className="h-3.5 w-3.5" />
        <span>พิมพ์ลาเบล ({selectedCount})</span>
      </Button>

      {/* Bulk Delete - Admin Only */}
      {userCanDelete && (
        <Button
          onClick={onBulkDelete}
          variant="outline"
          className="h-8 rounded-lg px-3 text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30 cursor-pointer"
        >
          ลบทั้งหมด
        </Button>
      )}

      <div className="h-4 w-px bg-border" />

      {/* Clear Selection */}
      <button
        onClick={onClearSelection}
        className="text-xs text-muted-foreground hover:text-card-foreground font-bold transition-colors cursor-pointer"
      >
        ยกเลิก
      </button>
    </div>
  )
}
