'use client'

import React, { useRef, useEffect, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Check, Copy, Package } from 'lucide-react'
import {
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableCell,
} from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ITEM_TYPE_LABELS, type ItemListRow, type ItemListSearchParams } from '@/features/items/types'
import { cn } from '@/lib/utils'
import { ItemThumbnail } from './item-thumbnail'
import { CategoryBadge } from './category-badge'
import { formatDateThaiBE } from '@/lib/date'

export interface ItemsListProps {
  items: (ItemListRow | null | undefined)[]
  density?: 'comfortable' | 'compact'
  startIndex?: number
  topSpace?: number
  bottomSpace?: number
  selectedItemId: string | null
  selectedItemIds: string[]
  onSelect: (item: ItemListRow) => void
  onDoubleClick?: (item: ItemListRow) => void
  onToggleSelectItem: (id: string) => void
  onToggleSelectAll: () => void
  allLoadedSelected: boolean
  params: ItemListSearchParams
  onToggleSort: (field: string) => void
  isInspectorOpen?: boolean
  userCanWrite?: boolean
  onCopy?: (value: string | null | undefined) => void
  onPrint?: (item: ItemListRow) => void
  onEdit?: (item: ItemListRow) => void
  mode?: 'standard' | 'ledger'
  onUpdateStatus?: (itemId: string, status: ItemListRow['status']) => Promise<void> | void
}

export function ItemsList({
  items,
  density = 'comfortable',
  startIndex = 0,
  allLoadedSelected,
  selectedItemId,
  selectedItemIds,
  onSelect,
  onDoubleClick,
  onToggleSelectItem,
  onToggleSelectAll,
  params,
  onToggleSort,
  isInspectorOpen = false,
  userCanWrite = false,
  onCopy,
  mode = 'standard',
  onUpdateStatus,
}: ItemsListProps) {
  const masterCheckboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = selectedItemIds.length > 0 && !allLoadedSelected
    }
  }, [selectedItemIds.length, allLoadedSelected])

  const renderSortHeader = (field: string, label: string, align: 'left' | 'center' | 'right' = 'left') => {
    const currentField = params.sort_by || 'updated_at'
    const currentDir = params.sort_dir || 'desc'
    const isSorted = currentField === field

    const alignClass = align === 'center' ? 'justify-center w-full' : align === 'right' ? 'justify-end w-full' : ''

    return (
      <button
        type="button"
        onClick={() => onToggleSort(field)}
        className={cn(
          "flex items-center gap-1 hover:text-card-foreground text-muted-foreground transition-colors font-bold uppercase cursor-pointer select-none",
          alignClass
        )}
      >
        <span>{label}</span>
        {isSorted ? (
          currentDir === 'asc' ? (
            <ArrowUp className="w-3 h-3 text-primary shrink-0" />
          ) : (
            <ArrowDown className="w-3 h-3 text-primary shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 text-muted-foreground/50 shrink-0" />
        )}
      </button>
    )
  }

  const getSortAria = (field: string): 'ascending' | 'descending' | 'none' => {
    const currentField = params.sort_by || 'updated_at'
    const currentDir = params.sort_dir || 'desc'
    if (currentField !== field) return 'none'
    return currentDir === 'asc' ? 'ascending' : 'descending'
  }

  const isLedger = mode === 'ledger'

  return (
    <div className="bg-muted/10 min-w-0">
      {isLedger && (
        <div className="bg-card/90 backdrop-blur-xs border-b border-border/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <span>ทะเบียนคุมสินทรัพย์</span>
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                แบบราชการ
              </span>
            </h3>
            <p className="text-muted-foreground text-[11px] mt-0.5">บัญชีแสดงรายการพัสดุคงเหลือ (ครุภัณฑ์ตามเกณฑ์)</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-[11px]">
            <span><strong className="text-foreground">หน่วยงาน:</strong> สำนักงานเขตสุขภาพที่ 7</span>
            <span><strong className="text-foreground">หมวด:</strong> {params.category_id ? 'ตามตัวกรอง' : 'ครุภัณฑ์ทั้งหมด'}</span>
          </div>
        </div>
      )}
      <DataTable
        responsive={false}
        wrapperClassName="border-0 rounded-none bg-transparent shadow-none overflow-x-auto min-w-0"
        className={cn(
          "text-card-foreground table-fixed w-full min-w-0",
          isLedger
            ? "min-w-[1360px]"
            : isInspectorOpen
              ? "min-w-[420px] xl:min-w-[640px] 2xl:min-w-[840px]"
              : "min-w-[480px] sm:min-w-[640px] md:min-w-[768px] xl:min-w-[960px]"
        )}
      >
        <caption className="sr-only">รายการทะเบียนพัสดุและครุภัณฑ์</caption>
        <DataTableHeader className="bg-muted/75 backdrop-blur-xs border-b border-border/80 sticky top-0 z-10">
          {isLedger ? (
            <>
              <tr>
                <DataTableHead rowSpan={2} isCheckbox className="w-10 px-3 align-middle">
                  <input
                    ref={masterCheckboxRef}
                    type="checkbox"
                    aria-label="เลือกทุกรายการที่โหลดอยู่"
                    checked={allLoadedSelected}
                    onChange={onToggleSelectAll}
                    className="rounded border-input text-primary focus:ring-ring w-4 h-4 cursor-pointer"
                  />
                </DataTableHead>
                <DataTableHead rowSpan={2} className="w-12 px-2 text-center align-middle font-bold text-muted-foreground">ลำดับ</DataTableHead>
                <DataTableHead rowSpan={2} className="w-28 px-2 text-center align-middle font-bold text-muted-foreground" aria-sort={getSortAria('acquired_date')}>
                  {renderSortHeader('acquired_date', 'วัน เดือน ปีที่รับ', 'center')}
                </DataTableHead>
                <DataTableHead rowSpan={2} className="w-32 px-2.5 align-middle font-bold text-muted-foreground" aria-sort={getSortAria('budget_source')}>
                  {renderSortHeader('budget_source', 'รับจาก (งปม.)')}
                </DataTableHead>
                <DataTableHead rowSpan={2} className="w-64 min-w-[200px] px-3 align-middle font-bold text-muted-foreground" aria-sort={getSortAria('item_name')}>
                  {renderSortHeader('item_name', 'รายการครุภัณฑ์')}
                </DataTableHead>
                <DataTableHead rowSpan={2} className="w-56 px-2.5 align-middle font-bold text-muted-foreground">ยี่ห้อ/รุ่น</DataTableHead>
                <DataTableHead rowSpan={2} className="w-24 px-2.5 text-right align-middle font-bold text-muted-foreground" aria-sort={getSortAria('unit_price')}>
                  {renderSortHeader('unit_price', 'ราคา', 'right')}
                </DataTableHead>
                <DataTableHead rowSpan={2} className="w-16 px-2 text-center align-middle font-bold text-muted-foreground">หน่วย</DataTableHead>
                <DataTableHead rowSpan={2} className="w-44 px-2.5 align-middle font-bold text-muted-foreground" aria-sort={getSortAria('asset_no')}>
                  {renderSortHeader('asset_no', 'เลขครุภัณฑ์')}
                </DataTableHead>
                <DataTableHead rowSpan={2} className="w-36 px-2.5 align-middle font-bold text-muted-foreground" aria-sort={getSortAria('gfmis_number')}>
                  {renderSortHeader('gfmis_number', 'เลขสินทรัพย์')}
                </DataTableHead>
                <DataTableHead rowSpan={2} className="w-36 px-2.5 align-middle font-bold text-muted-foreground" aria-sort={getSortAria('responsible_person')}>
                  {renderSortHeader('responsible_person', 'ผู้ครอบครอง')}
                </DataTableHead>
                <DataTableHead rowSpan={2} className="w-36 px-2.5 align-middle font-bold text-muted-foreground">ใช้งานที่</DataTableHead>
                <DataTableHead colSpan={3} className="text-center font-bold text-muted-foreground border-l border-r border-border/60 py-1 bg-muted/40 text-xs">
                  สภาพพัสดุ
                </DataTableHead>
                <DataTableHead rowSpan={2} className="w-28 px-2.5 align-middle font-bold text-muted-foreground">หมายเหตุ</DataTableHead>
              </tr>
              <tr className="border-b border-border/80 text-[11px]">
                <DataTableHead className="w-16 px-1 text-center font-semibold text-muted-foreground text-[11px] border-l border-border/40 py-1">ใช้งานได้</DataTableHead>
                <DataTableHead className="w-14 px-1 text-center font-semibold text-muted-foreground text-[11px] py-1">ชำรุด</DataTableHead>
                <DataTableHead className="w-16 px-1 text-center font-semibold text-muted-foreground text-[11px] border-r border-border/40 py-1">เสื่อมสภาพ</DataTableHead>
              </tr>
            </>
          ) : (
            <tr>
              <DataTableHead isCheckbox className="w-10 px-3">
                <input
                  ref={masterCheckboxRef}
                  type="checkbox"
                  aria-label="เลือกทุกรายการที่โหลดอยู่"
                  checked={allLoadedSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-input text-primary focus:ring-ring w-4 h-4 cursor-pointer"
                />
              </DataTableHead>
              <DataTableHead className="w-11 px-1" />
              <DataTableHead className="w-[300px] min-w-[300px] max-w-[320px] px-3" aria-sort={getSortAria('item_name')}>{renderSortHeader('item_name', 'ชื่อพัสดุและรหัส')}</DataTableHead>
              <DataTableHead className={cn("hidden w-20 px-2.5", isInspectorOpen ? "xl:table-cell" : "sm:table-cell")}>ประเภท</DataTableHead>
              <DataTableHead className={cn("hidden w-44 px-3", isInspectorOpen ? "2xl:table-cell" : "md:table-cell")} aria-sort={getSortAria('category')}>{renderSortHeader('category', 'หมวดหมู่')}</DataTableHead>
              <DataTableHead className="w-24 sm:w-28 px-2 sm:px-3 text-right" aria-sort={getSortAria('quantity')}>{renderSortHeader('quantity', 'จำนวน', 'right')}</DataTableHead>
              <DataTableHead className={cn("w-28 xl:w-36 px-2.5", isInspectorOpen ? "hidden xl:table-cell" : "hidden sm:table-cell")}>สถานที่</DataTableHead>
              <DataTableHead className={cn("hidden w-28 xl:w-36 px-2.5", isInspectorOpen ? "2xl:table-cell" : "xl:table-cell")}>ผู้รับผิดชอบ</DataTableHead>
              <DataTableHead className="w-24 sm:w-28 px-2 sm:px-3" aria-sort={getSortAria('status')}>{renderSortHeader('status', 'สถานะ')}</DataTableHead>
            </tr>
          )}
        </DataTableHeader>
        <DataTableBody className="divide-y divide-border/40 bg-transparent">
          {items.map((item, index) => {
            if (!item) return null
            return (
              <ItemTableRow
                key={item.id}
                item={item}
                index={startIndex + index}
                density={density}
                isSelected={selectedItemId === item.id}
                isChecked={selectedItemIds.includes(item.id)}
                onSelect={onSelect}
                onDoubleClick={onDoubleClick}
                onToggleSelectItem={onToggleSelectItem}
                isInspectorOpen={isInspectorOpen}
                userCanWrite={userCanWrite}
                onCopy={onCopy}
                mode={mode}
                onUpdateStatus={onUpdateStatus}
              />
            )
          })}
          {!items.length && <EmptyRows colSpan={isLedger ? 15 : 9} />}
        </DataTableBody>
      </DataTable>
    </div>
  )
}

export interface ItemTableRowProps {
  item: ItemListRow
  index?: number
  density?: 'comfortable' | 'compact'
  isSelected: boolean
  isChecked: boolean
  onSelect: (item: ItemListRow) => void
  onDoubleClick?: (item: ItemListRow) => void
  onToggleSelectItem: (id: string) => void
  isInspectorOpen?: boolean
  userCanWrite?: boolean
  onCopy?: (value: string | null | undefined) => void
  onPrint?: (item: ItemListRow) => void
  onEdit?: (item: ItemListRow) => void
  mode?: 'standard' | 'ledger'
  onUpdateStatus?: (itemId: string, status: ItemListRow['status']) => Promise<void> | void
}

export const ItemTableRow = React.memo(function ItemTableRow({
  item,
  index = 0,
  density = 'comfortable',
  isSelected,
  isChecked,
  onSelect,
  onDoubleClick,
  onToggleSelectItem,
  isInspectorOpen,
  userCanWrite = false,
  onCopy,
  mode = 'standard',
  onUpdateStatus,
}: ItemTableRowProps) {
  const [copied, setCopied] = useState(false)
  const isCompact = density === 'compact'
  const isLedger = mode === 'ledger'
  const assetCode = item.asset_no || item.serial_no
  const brandModel = [item.brand, item.model].filter(Boolean).join(' ')

  const isUsable = item.status === 'active' || item.status === 'spare'
  const isDamaged = item.status === 'damaged' || item.status === 'waiting_repair'
  const isDeteriorated = item.status === 'inactive' || item.status === 'disposed'

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!assetCode) return
    onCopy?.(assetCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter') {
      onSelect(item)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      const nextRow = (event.currentTarget as HTMLElement).nextElementSibling as HTMLElement | null
      nextRow?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      const prevRow = (event.currentTarget as HTMLElement).previousElementSibling as HTMLElement | null
      prevRow?.focus()
    }
  }

  const handleStatusChange = (e: React.MouseEvent, targetStatus: ItemListRow['status']) => {
    e.stopPropagation()
    if (!userCanWrite) return
    onUpdateStatus?.(item.id, targetStatus)
  }

  return (
    <DataTableRow
      tabIndex={0}
      onKeyDown={handleKeyDown}
      title={item.item_name}
      onClick={() => onSelect(item)}
      onDoubleClick={() => onDoubleClick?.(item)}
      className={cn(
        'group cursor-pointer transition-colors outline-none focus-visible:bg-muted/70 focus-visible:ring-1 focus-visible:ring-primary/50',
        isCompact
          ? 'h-[42px] max-h-[42px] [&>td]:h-[42px] [&>td]:max-w-0 [&>td]:truncate [&>td]:py-0'
          : 'h-[64px] max-h-[64px] [&>td]:h-[64px] [&>td]:max-w-0 [&>td]:truncate [&>td]:py-0',
        isSelected
          ? 'border-b border-primary/40 bg-primary/10 text-card-foreground shadow-2xs'
          : 'border-b border-border/40 text-card-foreground hover:bg-muted/40'
      )}
    >
      {/* Checkbox Column */}
      <DataTableCell isCheckbox className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label={`เลือก ${item.item_name}`}
          checked={isChecked}
          onChange={() => onToggleSelectItem(item.id)}
          className="rounded border-input text-primary focus:ring-ring w-4 h-4 cursor-pointer"
        />
      </DataTableCell>

      {isLedger ? (
        <>
          {/* ลำดับ (Index) */}
          <DataTableCell className="w-12 px-2 text-center text-xs font-mono text-muted-foreground tabular-nums">
            {index + 1}
          </DataTableCell>

          {/* วัน เดือน ปีที่รับ */}
          <DataTableCell className="w-28 px-2 text-center text-xs font-mono text-muted-foreground truncate" title={item.acquired_date ?? undefined}>
            {formatDateThaiBE(item.acquired_date)}
          </DataTableCell>

          {/* รับจาก (งปม.) */}
          <DataTableCell className="w-32 px-2.5 text-xs text-foreground truncate" title={item.budget_source || undefined}>
            {item.budget_source || '-'}
          </DataTableCell>

          {/* รายการครุภัณฑ์ (Asset Name) */}
          <DataTableCell className="w-64 min-w-[200px] px-3">
            <div className="flex items-center gap-2 min-w-0">
              <ItemThumbnail
                imageUrl={item.image_url}
                itemName={item.item_name}
                itemType={item.item_type}
                size="sm"
                className={isCompact ? "h-6 w-6 rounded shrink-0" : "h-8 w-8 rounded shrink-0"}
                showZoom={!isCompact}
              />
              <span className="truncate text-xs font-semibold text-foreground hover:text-primary transition-colors block flex-1" title={item.item_name}>
                {item.item_name}
              </span>
            </div>
          </DataTableCell>

          {/* ยี่ห้อ/รุ่น */}
          <DataTableCell className="w-56 px-2.5 text-xs text-muted-foreground truncate" title={[brandModel, item.serial_no ? `s/n: ${item.serial_no}` : ''].filter(Boolean).join(' • ') || undefined}>
            <div className="truncate">
              <span className="text-foreground">{brandModel || '-'}</span>
              {item.serial_no && (
                <span className="text-[11px] font-mono text-muted-foreground/80 block truncate">
                  s/n: {item.serial_no}
                </span>
              )}
            </div>
          </DataTableCell>

          {/* ราคา */}
          <DataTableCell className="w-24 px-2.5 text-right font-mono text-xs tabular-nums text-foreground">
            {item.unit_price !== null && item.unit_price !== undefined
              ? Number(item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : '-'}
          </DataTableCell>

          {/* หน่วย */}
          <DataTableCell className="w-16 px-2 text-center text-xs text-muted-foreground truncate" title={item.unit?.name || undefined}>
            {item.unit?.name || '-'}
          </DataTableCell>

          {/* เลขครุภัณฑ์ */}
          <DataTableCell className="w-44 px-2.5 font-mono text-xs text-foreground truncate" title={item.asset_no || undefined}>
            {item.asset_no ? (
              <button
                type="button"
                onClick={handleCopy}
                title={`คัดลอก ${item.asset_no}`}
                aria-label={`คัดลอก ${item.asset_no}`}
                className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer group/badge truncate max-w-full"
              >
                <span className="truncate">{item.asset_no}</span>
                {copied ? <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" /> : <Copy className="w-2.5 h-2.5 opacity-40 group-hover/badge:opacity-100 shrink-0" />}
              </button>
            ) : (
              <span className="text-muted-foreground/40 italic">-</span>
            )}
          </DataTableCell>

          {/* เลขสินทรัพย์ GFMIS */}
          <DataTableCell className="w-36 px-2.5 font-mono text-xs text-foreground truncate" title={item.gfmis_number || undefined}>
            {item.gfmis_number || '-'}
          </DataTableCell>

          {/* ผู้ครอบครอง */}
          <DataTableCell className="w-36 px-2.5 text-xs text-foreground truncate" title={item.responsible_person || undefined}>
            {item.responsible_person || '-'}
          </DataTableCell>

          {/* ใช้งานที่ */}
          <DataTableCell className="w-36 px-2.5 text-xs text-muted-foreground truncate" title={item.location?.name || undefined}>
            {item.location?.name || '-'}
          </DataTableCell>

          {/* สภาพพัสดุ: ใช้งานได้ */}
          <DataTableCell className="w-16 px-1 text-center border-l border-border/40 py-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={!userCanWrite}
              onClick={(e) => handleStatusChange(e, 'active')}
              title={isUsable ? "ใช้งานได้" : userCanWrite ? "คลิกเพื่อเปลี่ยนสภาพเป็น [ใช้งานได้]" : "สภาพใช้งานได้"}
              aria-label={`${item.item_name} สภาพใช้งานได้`}
              className={cn(
                "w-6 h-6 mx-auto rounded flex items-center justify-center text-xs transition-all",
                isUsable
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold"
                  : userCanWrite
                    ? "border border-border/80 hover:border-emerald-500/60 hover:bg-emerald-500/10 text-transparent hover:text-emerald-500/40 cursor-pointer"
                    : "border border-border/30 opacity-30 cursor-default"
              )}
            >
              ✓
            </button>
          </DataTableCell>

          {/* สภาพพัสดุ: ชำรุด */}
          <DataTableCell className="w-14 px-1 text-center py-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={!userCanWrite}
              onClick={(e) => handleStatusChange(e, 'damaged')}
              title={isDamaged ? "ชำรุด" : userCanWrite ? "คลิกเพื่อเปลี่ยนสภาพเป็น [ชำรุด]" : "สภาพชำรุด"}
              aria-label={`${item.item_name} สภาพชำรุด`}
              className={cn(
                "w-6 h-6 mx-auto rounded flex items-center justify-center text-xs transition-all",
                isDamaged
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold"
                  : userCanWrite
                    ? "border border-border/80 hover:border-rose-500/60 hover:bg-rose-500/10 text-transparent hover:text-rose-500/40 cursor-pointer"
                    : "border border-border/30 opacity-30 cursor-default"
              )}
            >
              ✓
            </button>
          </DataTableCell>

          {/* สภาพพัสดุ: เสื่อมสภาพ */}
          <DataTableCell className="w-16 px-1 text-center border-r border-border/40 py-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={!userCanWrite}
              onClick={(e) => handleStatusChange(e, 'inactive')}
              title={isDeteriorated ? "เสื่อมสภาพ" : userCanWrite ? "คลิกเพื่อเปลี่ยนสภาพเป็น [เสื่อมสภาพ]" : "สภาพเสื่อมสภาพ"}
              aria-label={`${item.item_name} สภาพเสื่อมสภาพ`}
              className={cn(
                "w-6 h-6 mx-auto rounded flex items-center justify-center text-xs transition-all",
                isDeteriorated
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold"
                  : userCanWrite
                    ? "border border-border/80 hover:border-amber-500/60 hover:bg-amber-500/10 text-transparent hover:text-amber-500/40 cursor-pointer"
                    : "border border-border/30 opacity-30 cursor-default"
              )}
            >
              ✓
            </button>
          </DataTableCell>

          {/* หมายเหตุ */}
          <DataTableCell className="w-28 px-2.5 text-xs text-muted-foreground truncate" title={item.note || undefined}>
            {item.note || '-'}
          </DataTableCell>
        </>
      ) : (
        <>
          {/* Visual Thumbnail */}
          <DataTableCell className="w-11 px-1">
            <ItemThumbnail
              imageUrl={item.image_url}
              itemName={item.item_name}
              itemType={item.item_type}
              size="sm"
              className={isCompact ? "h-7 w-7 rounded-md" : undefined}
              showZoom={!isCompact}
            />
          </DataTableCell>

          {/* Rich Primary Compound Column: Title, Asset Code Badge, Brand/Model */}
          <DataTableCell className="w-[300px] min-w-[300px] max-w-[320px] px-3 overflow-hidden">
            {isCompact ? (
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span
                  className="truncate text-xs font-bold text-foreground hover:text-primary transition-colors block max-w-[170px]"
                  title={item.item_name}
                >
                  {item.item_name}
                </span>
                {assetCode && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    title={`คัดลอก ${assetCode}`}
                    aria-label={`คัดลอก ${assetCode}`}
                    className="inline-flex items-center gap-1 rounded bg-muted/80 hover:bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground/90 border border-border/70 shrink-0 transition-colors cursor-pointer group/badge"
                  >
                    <span className="truncate max-w-[90px]">{assetCode}</span>
                    {copied ? (
                      <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Copy className="w-2.5 h-2.5 opacity-60 group-hover/badge:opacity-100 group-focus-within/badge:opacity-100 transition-opacity shrink-0" />
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col justify-center min-w-0 pr-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="truncate text-[13.5px] font-bold text-foreground hover:text-primary transition-colors leading-5 block w-full"
                    title={item.item_name}
                  >
                    {item.item_name}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-2 min-w-0 text-xs leading-none">
                  {assetCode ? (
                    <button
                      type="button"
                      onClick={handleCopy}
                      title={`คัดลอก ${assetCode}`}
                      aria-label={`คัดลอก ${assetCode}`}
                      className="inline-flex items-center gap-1 rounded bg-muted/80 hover:bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground/90 border border-border/70 shrink-0 max-w-full transition-colors cursor-pointer group/badge"
                    >
                      <span className="truncate">{assetCode}</span>
                      {copied ? (
                        <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Copy className="w-2.5 h-2.5 opacity-60 group-hover/badge:opacity-100 group-focus-within/badge:opacity-100 transition-opacity shrink-0" />
                      )}
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-muted-foreground/60 italic shrink-0">
                      ไม่มีเลขครุภัณฑ์
                    </span>
                  )}

                  {brandModel && (
                    <span className="truncate text-muted-foreground text-[11.5px] leading-none" title={brandModel}>
                      • {brandModel}
                    </span>
                  )}
                </div>
              </div>
            )}
          </DataTableCell>

          {/* Type Column */}
          <DataTableCell className={cn("hidden w-20 px-2.5 text-xs font-semibold text-muted-foreground", isInspectorOpen ? "xl:table-cell" : "sm:table-cell")}>
            <span className="inline-flex items-center rounded-lg bg-muted/60 px-2 py-0.5 text-xs border border-border/40 truncate">
              {ITEM_TYPE_LABELS[item.item_type]}
            </span>
          </DataTableCell>

          {/* Category Column */}
          <DataTableCell className={cn("hidden w-44 px-3 text-xs text-muted-foreground truncate", isInspectorOpen ? "2xl:table-cell" : "md:table-cell")} title={item.category?.name || undefined}>
            {item.category ? (
              <CategoryBadge name={item.category.name} color={item.category.color} icon={item.category.icon} />
            ) : (
              <span className="text-muted-foreground/50">-</span>
            )}
          </DataTableCell>

          {/* Quantity & Unit Column */}
          <DataTableCell className="w-24 sm:w-28 px-2 sm:px-3 text-right">
            <div className="flex items-baseline justify-end gap-1.5 w-full min-w-0">
              <span className="font-extrabold text-foreground text-sm tabular-nums text-right flex-1 min-w-0">
                {item.quantity}
              </span>
              <span
                className="text-xs font-normal text-muted-foreground truncate w-10 sm:w-12 text-left shrink-0"
                title={item.unit?.name || undefined}
              >
                {item.unit?.name ?? ''}
              </span>
            </div>
          </DataTableCell>

          {/* Location Column */}
          <DataTableCell
            className={cn(
              "w-28 xl:w-36 px-2.5 text-xs font-medium text-muted-foreground truncate",
              isInspectorOpen ? "hidden xl:table-cell" : "hidden sm:table-cell"
            )}
            title={item.location?.name || undefined}
          >
            {item.location?.name ? (
              <span className="truncate block" title={item.location.name}>
                {item.location.name}
              </span>
            ) : (
              <span className="text-muted-foreground/50">-</span>
            )}
          </DataTableCell>

          {/* Responsible Person Column */}
          <DataTableCell
            className={cn(
              "hidden w-28 xl:w-36 px-2.5 text-xs font-medium text-muted-foreground truncate",
              isInspectorOpen ? "2xl:table-cell" : "xl:table-cell"
            )}
            title={item.responsible_person || undefined}
          >
            {item.responsible_person ? (
              <span className="truncate block" title={item.responsible_person}>
                {item.responsible_person}
              </span>
            ) : (
              <span className="text-muted-foreground/50">-</span>
            )}
          </DataTableCell>

          {/* Status Column */}
          <DataTableCell className="w-24 sm:w-28 px-2 sm:px-3">
            <StatusBadge status={item.status} size="sm" showDot className="shrink-0" />
          </DataTableCell>
        </>
      )}
    </DataTableRow>
  )
})

function EmptyRows({ colSpan = 9 }: { colSpan?: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-12">
        <EmptyState
          title="ไม่พบข้อมูลสิ่งของ"
          description="ลองล้างตัวกรองหรือขึ้นทะเบียนรายการใหม่"
          icon={<Package className="h-10 w-10 text-muted-foreground opacity-60" />}
          className="border-0 shadow-none bg-transparent"
        />
      </td>
    </tr>
  )
}
