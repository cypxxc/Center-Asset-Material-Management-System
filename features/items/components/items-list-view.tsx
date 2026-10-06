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
    <div className="bg-muted/20">
      <DataTable responsive={false} wrapperClassName="border-0 rounded-none bg-transparent shadow-none overflow-visible" className="text-card-foreground table-fixed min-w-[768px] sm:min-w-[856px] md:min-w-[960px] xl:min-w-[1100px]">
        <DataTableHeader className="bg-muted border-b border-border">
          <tr>
            <DataTableHead isCheckbox className="w-9 px-2">
              <input
                ref={masterCheckboxRef}
                type="checkbox"
                aria-label="เลือกทุกรายการที่โหลดอยู่"
                checked={allLoadedSelected}
                onChange={onToggleSelectAll}
                className="rounded border-input text-primary focus:ring-ring w-4 h-4 cursor-pointer"
              />
            </DataTableHead>
            <DataTableHead className="w-10 px-1" />
            <DataTableHead className="px-3" aria-sort={getSortAria('item_name')}>{renderSortHeader('item_name', 'ชื่อพัสดุ')}</DataTableHead>
            <DataTableHead className="hidden w-[88px] px-3 sm:table-cell" aria-sort={getSortAria('item_type')}>{renderSortHeader('item_type', 'ประเภท')}</DataTableHead>
            <DataTableHead className="hidden w-28 px-3 md:table-cell">หมวดหมู่</DataTableHead>
            <DataTableHead className="w-[88px] px-2" aria-sort={getSortAria('quantity')}>{renderSortHeader('quantity', 'จำนวน', 'center')}</DataTableHead>
            <DataTableHead className="w-[136px] px-3">สถานที่</DataTableHead>
            <DataTableHead className="hidden w-[136px] px-3 xl:table-cell">ผู้รับผิดชอบ</DataTableHead>
            <DataTableHead className="w-28 px-3" aria-sort={getSortAria('status')}>{renderSortHeader('status', 'สถานะ')}</DataTableHead>
          </tr>
        </DataTableHeader>
        <DataTableBody className="divide-y divide-border/40 bg-transparent">
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
  return (
    <DataTableRow
      tabIndex={0}
      onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') onSelect(item) }}
      title={item.item_name}
      onClick={() => onSelect(item)}
      onDoubleClick={() => onDoubleClick?.(item)}
      className={cn(
        'h-16 max-h-16 [&>td]:h-16 [&>td]:max-w-0 [&>td]:truncate [&>td]:py-1 cursor-pointer transition-colors',
        isSelected
          ? 'border-b border-primary/30 bg-primary/10 text-card-foreground'
          : 'border-b border-border/60 text-card-foreground hover:bg-muted/40'
      )}
    >
      <DataTableCell isCheckbox className="px-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label={`เลือก ${item.item_name}`}
          checked={isChecked}
          onChange={() => onToggleSelectItem(item.id)}
          className="rounded border-input text-primary focus:ring-ring w-4 h-4 cursor-pointer"
        />
      </DataTableCell>
      <DataTableCell className="px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground">
          {typeIcons[item.item_type]}
        </div>
      </DataTableCell>
      <DataTableCell className="px-3">
        <div className="line-clamp-2 whitespace-normal break-words text-[13px] leading-[18px] font-extrabold text-card-foreground" title={item.item_name}>{item.item_name}</div>
        <div className="mt-0.5 truncate font-mono text-xs leading-[14px] text-muted-foreground" title={item.asset_no || item.serial_no || undefined}>
          {item.asset_no || item.serial_no || '- ไม่มีเลขอ้างอิง -'}
        </div>
      </DataTableCell>
      <DataTableCell className="hidden px-3 font-semibold text-muted-foreground sm:table-cell">{ITEM_TYPE_LABELS[item.item_type]}</DataTableCell>
      <DataTableCell className="hidden px-3 text-muted-foreground md:table-cell" title={item.category?.name}>{item.category?.name ?? '-'}</DataTableCell>
      <DataTableCell className="px-2 text-center font-extrabold text-card-foreground">{item.quantity} {item.unit?.name ?? ''}</DataTableCell>
      <DataTableCell className="px-3 font-semibold text-muted-foreground" title={item.location?.name}>{item.location?.name ?? '-'}</DataTableCell>
      <DataTableCell className="hidden px-3 font-semibold text-muted-foreground xl:table-cell" title={item.responsible_person ?? undefined}>{item.responsible_person ?? '-'}</DataTableCell>
      <DataTableCell className="px-3"><StatusBadge status={item.status} /></DataTableCell>
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
