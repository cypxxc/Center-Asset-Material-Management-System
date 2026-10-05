'use client'

import { Check, Package } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { ITEM_TYPE_LABELS, type ItemListRow } from '@/features/items/types'
import { cn } from '@/lib/utils'
import { typeIcons } from './item-type-icon'

export interface ItemsGridProps {
  columns: number
  items: (ItemListRow | null | undefined)[]
  topSpace: number
  bottomSpace: number
  selectedItemId: string | null
  selectedItemIds: string[]
  onSelect: (item: ItemListRow) => void
  onDoubleClick?: (item: ItemListRow) => void
  onToggleSelectItem: (id: string) => void
}

export function ItemsGrid({
  items,
  columns,
  topSpace,
  bottomSpace,
  selectedItemId,
  selectedItemIds,
  onSelect,
  onDoubleClick,
  onToggleSelectItem,
}: ItemsGridProps) {
  return (
    <div className="bg-muted/20 p-4" style={{ paddingTop: topSpace + 16, paddingBottom: bottomSpace + 16 }}>
      {items.length ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: 208 }}>
          {items.map((item, slot) => {
            if (!item) return <div key={`slot-${slot}`} className="p-4 text-muted-foreground">{item === undefined ? 'กำลังโหลดรายการ...' : ''}</div>
            const isSelected = selectedItemId === item.id
            const isChecked = selectedItemIds.includes(item.id)
            return (
              <div
                key={item.id}
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
                {/* Checkbox Overlay */}
                <div className="absolute top-3 right-3 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onToggleSelectItem(item.id)}
                    type="button"
                    aria-label={`เลือก ${item.item_name}`}
                    aria-pressed={isChecked}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded border transition-colors cursor-pointer',
                      isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                    )}
                  >
                    {isChecked && <Check className="w-4 h-4 stroke-[3px]" />}
                  </button>
                </div>

                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-muted-foreground shadow-inner transition-transform group-hover:scale-105">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.item_name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    typeIcons[item.item_type]
                  )}
                </div>
                <p className="line-clamp-2 text-xs font-extrabold leading-snug text-card-foreground pr-4">{item.item_name}</p>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{item.asset_no || item.serial_no || '-'}</p>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    {ITEM_TYPE_LABELS[item.item_type]}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">{item.quantity} {item.unit?.name ?? ''}</span>
                </div>
              </div>
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
