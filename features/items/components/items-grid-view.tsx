'use client'

import React from 'react'
import { Check, Copy, Edit, Package, Printer } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { ITEM_TYPE_LABELS, type ItemListRow } from '@/features/items/types'
import { cn } from '@/lib/utils'
import { CategoryBadge } from './category-badge'
import { typeIcons } from './item-type-icon'

interface ItemGridCardProps {
  item: ItemListRow
  isSelected: boolean
  isChecked: boolean
  onSelect: (item: ItemListRow) => void
  onDoubleClick?: (item: ItemListRow) => void
  onToggleSelectItem: (id: string) => void
  userCanWrite?: boolean
  onCopy?: (value: string | null | undefined) => void
  onPrint?: (item: ItemListRow) => void
  onEdit?: (item: ItemListRow) => void
}

const ItemGridCard = React.memo(function ItemGridCard({
  item,
  isSelected,
  isChecked,
  onSelect,
  onDoubleClick,
  onToggleSelectItem,
  userCanWrite = false,
  onCopy,
  onPrint,
  onEdit,
}: ItemGridCardProps) {
  return (
    <div
      tabIndex={0}
      onKeyDown={event => { if (event.target === event.currentTarget && event.key === 'Enter') onSelect(item) }}
      title={item.item_name}
      onClick={() => onSelect(item)}
      onDoubleClick={() => onDoubleClick?.(item)}
      className={cn(
        'group relative flex h-[208px] min-w-0 overflow-hidden flex-col rounded-lg border p-3 text-left transition-all cursor-pointer',
        isSelected ? 'border-primary/40 bg-primary/10 ring-2 ring-primary/20' : 'border-border bg-card hover:border-border/80 hover:shadow-2xs'
      )}
    >
      {/* Actions & Checkbox Overlay */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {/* Quick Action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          {onCopy && (item.asset_no || item.serial_no) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onCopy(item.asset_no || item.serial_no)
              }}
              title={`คัดลอก ${item.asset_no || item.serial_no}`}
              aria-label={`คัดลอก ${item.asset_no || item.serial_no}`}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card/90 shadow-2xs text-muted-foreground hover:bg-card hover:text-foreground transition-colors cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
          {userCanWrite && onPrint && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onPrint(item)
              }}
              title="พิมพ์ป้ายบาร์โค้ด"
              aria-label={`พิมพ์ป้ายบาร์โค้ด ${item.item_name}`}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card/90 shadow-2xs text-muted-foreground hover:bg-card hover:text-foreground transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
          )}
          {userCanWrite && onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(item)
              }}
              title="แก้ไขข้อมูล"
              aria-label={`แก้ไขข้อมูล ${item.item_name}`}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card/90 shadow-2xs text-muted-foreground hover:bg-card hover:text-foreground transition-colors cursor-pointer"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Selection Checkbox */}
        <button
          onClick={() => onToggleSelectItem(item.id)}
          type="button"
          aria-label={`เลือก ${item.item_name}`}
          aria-pressed={isChecked}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md border transition-colors cursor-pointer shadow-2xs',
            isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-card/90 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          )}
        >
          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
        </button>
      </div>

      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-muted-foreground shadow-inner transition-transform group-hover:scale-105">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.item_name}
            loading="eager"
            decoding="auto"
            className="w-full h-full object-cover rounded-lg"
          />
        ) : (
          typeIcons[item.item_type]
        )}
      </div>
      <p className="line-clamp-2 text-xs font-extrabold leading-snug text-card-foreground pr-4">{item.item_name}</p>
      <div className="mt-1 flex items-center justify-between gap-1 min-w-0">
        <p className="truncate font-mono text-xs text-muted-foreground flex-1 min-w-0">{item.asset_no || item.serial_no || '-'}</p>
        {item.category && (
          <div className="max-w-[120px] truncate">
            <CategoryBadge name={item.category.name} color={item.category.color} icon={item.category.icon} className="text-[10px] px-1.5 py-0" />
          </div>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between pt-3">
        <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
          {ITEM_TYPE_LABELS[item.item_type]}
        </span>
        <span className="text-xs font-bold text-muted-foreground">{item.quantity} {item.unit?.name ?? ''}</span>
      </div>
    </div>
  )
})

export interface ItemsGridProps {
  columns?: number
  items: (ItemListRow | null | undefined)[]
  startIndex?: number
  topSpace?: number
  bottomSpace?: number
  selectedItemId: string | null
  selectedItemIds: string[]
  onSelect: (item: ItemListRow) => void
  onDoubleClick?: (item: ItemListRow) => void
  onToggleSelectItem: (id: string) => void
  userCanWrite?: boolean
  onCopy?: (value: string | null | undefined) => void
  onPrint?: (item: ItemListRow) => void
  onEdit?: (item: ItemListRow) => void
}

export function ItemsGrid({
  items,
  columns = 4,
  selectedItemId,
  selectedItemIds,
  onSelect,
  onDoubleClick,
  onToggleSelectItem,
  userCanWrite = false,
  onCopy,
  onPrint,
  onEdit,
}: ItemsGridProps) {
  return (
    <div className="bg-muted/20 p-4">
      {items.length ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: 208 }}>
          {items.map((item) => {
            if (!item) return null
            return (
              <ItemGridCard
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                isChecked={selectedItemIds.includes(item.id)}
                onSelect={onSelect}
                onDoubleClick={onDoubleClick}
                onToggleSelectItem={onToggleSelectItem}
                userCanWrite={userCanWrite}
                onCopy={onCopy}
                onPrint={onPrint}
                onEdit={onEdit}
              />
            )
          })}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center p-8">
          <EmptyState
            title="ไม่พบข้อมูลสิ่งของในทะเบียน"
            description="ลองล้างตัวกรองหรือขึ้นทะเบียนรายการใหม่"
            icon={<Package className="h-10 w-10 text-muted-foreground opacity-60" />}
            className="border-0 shadow-none bg-transparent"
          />
        </div>
      )}
    </div>
  )
}
