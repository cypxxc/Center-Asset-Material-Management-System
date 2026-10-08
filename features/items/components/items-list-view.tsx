'use client'

import React, { useRef, useEffect } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Package } from 'lucide-react'
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
import { typeIcons } from './item-type-icon'

export interface ItemsListProps {
  items: (ItemListRow | null | undefined)[]
  topSpace: number
  bottomSpace: number
  selectedItemId: string | null
  selectedItemIds: string[]
  onSelect: (item: ItemListRow) => void
  onDoubleClick?: (item: ItemListRow) => void
  onToggleSelectItem: (id: string) => void
  onToggleSelectAll: () => void
  allLoadedSelected: boolean
  params: ItemListSearchParams
  onToggleSort: (field: string) => void
}

export function ItemsList({
  items,
  topSpace,
  bottomSpace,
  allLoadedSelected,
  selectedItemId,
  selectedItemIds,
  onSelect,
  onDoubleClick,
  onToggleSelectItem,
  onToggleSelectAll,
  params,
  onToggleSort,
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
    <div className="bg-muted/10">
      <DataTable responsive={false} wrapperClassName="border-0 rounded-none bg-transparent shadow-none overflow-visible" className="text-card-foreground table-fixed min-w-[768px] sm:min-w-[856px] md:min-w-[960px] xl:min-w-[1100px]">
        <DataTableHeader className="bg-muted/80 backdrop-blur-xs border-b border-border sticky top-0 z-10">
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
            <DataTableHead className="px-3" aria-sort={getSortAria('item_name')}>{renderSortHeader('item_name', 'ชื่อพัสดุและรหัส')}</DataTableHead>
            <DataTableHead className="hidden w-[96px] px-3 sm:table-cell" aria-sort={getSortAria('item_type')}>{renderSortHeader('item_type', 'ประเภท')}</DataTableHead>
            <DataTableHead className="hidden w-32 px-3 md:table-cell">หมวดหมู่</DataTableHead>
            <DataTableHead className="w-[100px] px-3" aria-sort={getSortAria('quantity')}>{renderSortHeader('quantity', 'จำนวน', 'center')}</DataTableHead>
            <DataTableHead className="w-[140px] px-3">สถานที่</DataTableHead>
            <DataTableHead className="hidden w-[140px] px-3 xl:table-cell">ผู้รับผิดชอบ</DataTableHead>
            <DataTableHead className="w-32 px-3" aria-sort={getSortAria('status')}>{renderSortHeader('status', 'สถานะ')}</DataTableHead>
          </tr>
        </DataTableHeader>
        <DataTableBody className="divide-y divide-border/50 bg-transparent">
          <tr aria-hidden="true"><td colSpan={9} style={{ height: topSpace, padding: 0, border: 0 }} /></tr>
          {items.map((item, slot) => {
            if (!item) return <tr key={`slot-${slot}`} style={{ height: 64 }}><td colSpan={9} className="px-4 text-muted-foreground">{item === undefined ? 'กำลังโหลดรายการ...' : ''}</td></tr>
            return (
              <ItemTableRow
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                isChecked={selectedItemIds.includes(item.id)}
                onSelect={onSelect}
                onDoubleClick={onDoubleClick}
                onToggleSelectItem={onToggleSelectItem}
              />
            )
          })}
          <tr aria-hidden="true"><td colSpan={9} style={{ height: bottomSpace, padding: 0, border: 0 }} /></tr>
          {!items.length && !topSpace && !bottomSpace && <EmptyRows />}
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
}

export const ItemTableRow = React.memo(function ItemTableRow({
  item,
  isSelected,
  isChecked,
  onSelect,
  onDoubleClick,
  onToggleSelectItem,
}: ItemTableRowProps) {
  const assetCode = item.asset_no || item.serial_no
  const brandModel = [item.brand, item.model].filter(Boolean).join(' ')

  return (
    <DataTableRow
      tabIndex={0}
      onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') onSelect(item) }}
      title={item.item_name}
      onClick={() => onSelect(item)}
      onDoubleClick={() => onDoubleClick?.(item)}
      className={cn(
        'h-[72px] max-h-[72px] [&>td]:h-[72px] [&>td]:max-w-0 [&>td]:truncate [&>td]:py-1.5 cursor-pointer transition-all',
        isSelected
          ? 'border-b border-primary/40 bg-primary/10 text-card-foreground shadow-2xs'
          : 'border-b border-border/60 text-card-foreground hover:bg-muted/50'
      )}
    >
      {/* Checkbox Column */}
      <DataTableCell isCheckbox className="px-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label={`เลือก ${item.item_name}`}
          checked={isChecked}
          onChange={() => onToggleSelectItem(item.id)}
          className="rounded border-input text-primary focus:ring-ring w-4 h-4 cursor-pointer"
        />
      </DataTableCell>

      {/* Type Icon Thumbnail */}
      <DataTableCell className="px-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/80 border border-border/60 text-muted-foreground shadow-2xs shrink-0">
          {typeIcons[item.item_type]}
        </div>
      </DataTableCell>

      {/* Rich Primary Compound Column: Title, Asset Code Badge, Brand/Model */}
      <DataTableCell className="px-3">
        <div className="flex flex-col justify-center min-w-0 pr-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="truncate text-[13.5px] font-bold text-foreground hover:text-primary transition-colors leading-tight"
              title={item.item_name}
            >
              {item.item_name}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-2 min-w-0 text-xs">
            {assetCode ? (
              <span
                className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground/80 border border-border/70 shrink-0 leading-none"
                title={assetCode}
              >
                {assetCode}
              </span>
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
      <DataTableCell className="hidden px-3 text-xs font-semibold text-muted-foreground sm:table-cell">
        <span className="inline-flex items-center rounded-lg bg-muted/60 px-2 py-1 text-xs border border-border/40">
          {ITEM_TYPE_LABELS[item.item_type]}
        </span>
      </DataTableCell>

      {/* Category Column */}
      <DataTableCell className="hidden px-3 text-xs text-muted-foreground md:table-cell" title={item.category?.name}>
        {item.category?.name ?? '-'}
      </DataTableCell>

      {/* Quantity & Unit Column */}
      <DataTableCell className="px-3 text-center">
        <span className="font-extrabold text-foreground text-sm">
          {item.quantity}
        </span>
        {item.unit?.name && (
          <span className="ml-1 text-xs font-medium text-muted-foreground">
            {item.unit.name}
          </span>
        )}
      </DataTableCell>

      {/* Location Column */}
      <DataTableCell className="px-3 text-xs font-medium text-muted-foreground" title={item.location?.name}>
        {item.location?.name ?? '-'}
      </DataTableCell>

      {/* Responsible Person Column */}
      <DataTableCell className="hidden px-3 text-xs font-medium text-muted-foreground xl:table-cell" title={item.responsible_person ?? undefined}>
        {item.responsible_person ?? '-'}
      </DataTableCell>

      {/* Status Pill Column */}
      <DataTableCell className="px-3">
        <StatusBadge status={item.status} size="sm" showDot />
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
