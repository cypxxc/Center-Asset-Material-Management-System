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

export interface ItemsListProps {
  items: (ItemListRow | null | undefined)[]
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
}

export function ItemsList({
  items,
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
  onCopy,
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

  return (
    <div className="bg-muted/10 min-w-0">
      <DataTable
        responsive={false}
        wrapperClassName="border-0 rounded-none bg-transparent shadow-none overflow-visible min-w-0"
        className={cn(
          "text-card-foreground table-fixed w-full min-w-0",
          isInspectorOpen
            ? "min-w-[420px] xl:min-w-[640px] 2xl:min-w-[840px]"
            : "min-w-[480px] sm:min-w-[640px] md:min-w-[768px] xl:min-w-[960px]"
        )}
      >
        <DataTableHeader className="bg-muted/75 backdrop-blur-xs border-b border-border/80 sticky top-0 z-10">
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
            <DataTableHead className={cn("hidden w-20 px-2.5", isInspectorOpen ? "xl:table-cell" : "sm:table-cell")} aria-sort={getSortAria('item_type')}>{renderSortHeader('item_type', 'ประเภท')}</DataTableHead>
            <DataTableHead className={cn("hidden w-44 px-3", isInspectorOpen ? "2xl:table-cell" : "md:table-cell")}>หมวดหมู่</DataTableHead>
            <DataTableHead className="w-20 sm:w-24 px-2 sm:px-3 text-right" aria-sort={getSortAria('quantity')}>{renderSortHeader('quantity', 'จำนวน', 'right')}</DataTableHead>
            <DataTableHead className={cn("w-28 xl:w-36 px-2.5", isInspectorOpen ? "hidden xl:table-cell" : "hidden sm:table-cell")}>สถานที่</DataTableHead>
            <DataTableHead className={cn("hidden w-28 xl:w-36 px-2.5", isInspectorOpen ? "2xl:table-cell" : "xl:table-cell")}>ผู้รับผิดชอบ</DataTableHead>
            <DataTableHead className="w-24 sm:w-28 px-2 sm:px-3" aria-sort={getSortAria('status')}>{renderSortHeader('status', 'สถานะ')}</DataTableHead>
          </tr>
        </DataTableHeader>
        <DataTableBody className="divide-y divide-border/40 bg-transparent">
          {items.map((item) => {
            if (!item) return null
            return (
              <ItemTableRow
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                isChecked={selectedItemIds.includes(item.id)}
                onSelect={onSelect}
                onDoubleClick={onDoubleClick}
                onToggleSelectItem={onToggleSelectItem}
                isInspectorOpen={isInspectorOpen}
                onCopy={onCopy}
              />
            )
          })}
          {!items.length && <EmptyRows />}
        </DataTableBody>
      </DataTable>
    </div>
  )
}

export interface ItemTableRowProps {
  item: ItemListRow
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
}

export const ItemTableRow = React.memo(function ItemTableRow({
  item,
  isSelected,
  isChecked,
  onSelect,
  onDoubleClick,
  onToggleSelectItem,
  isInspectorOpen,
  onCopy,
}: ItemTableRowProps) {
  const [copied, setCopied] = useState(false)
  const assetCode = item.asset_no || item.serial_no
  const brandModel = [item.brand, item.model].filter(Boolean).join(' ')

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!assetCode) return
    onCopy?.(assetCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <DataTableRow
      tabIndex={0}
      onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') onSelect(item) }}
      title={item.item_name}
      onClick={() => onSelect(item)}
      onDoubleClick={() => onDoubleClick?.(item)}
      className={cn(
        'group h-[64px] max-h-[64px] [&>td]:h-[64px] [&>td]:max-w-0 [&>td]:truncate [&>td]:py-0 cursor-pointer transition-colors',
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

      {/* Visual Thumbnail */}
      <DataTableCell className="w-11 px-1">
        <ItemThumbnail
          imageUrl={item.image_url}
          itemName={item.item_name}
          itemType={item.item_type}
          size="sm"
          showZoom
        />
      </DataTableCell>

      {/* Rich Primary Compound Column: Title, Asset Code Badge, Brand/Model */}
      <DataTableCell className="w-[300px] min-w-[300px] max-w-[320px] px-3 overflow-hidden">
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
          <CategoryBadge name={item.category.name} color={item.category.color} />
        ) : (
          <span className="text-muted-foreground/50">-</span>
        )}
      </DataTableCell>

      {/* Quantity & Unit Column */}
      <DataTableCell className="w-20 sm:w-24 px-2 sm:px-3 text-right">
        <div className="inline-flex items-baseline justify-end gap-1 w-full min-w-0">
          <span className="font-extrabold text-foreground text-sm tabular-nums">
            {item.quantity}
          </span>
          {item.unit?.name && (
            <span className="text-xs font-normal text-muted-foreground truncate max-w-[42px]" title={item.unit.name}>
              {item.unit.name}
            </span>
          )}
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
    </DataTableRow>
  )
})

export function EmptyRows() {
  return (
    <tr>
      <td colSpan={9} className="px-5 py-12">
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
