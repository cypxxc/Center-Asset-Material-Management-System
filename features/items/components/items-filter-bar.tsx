'use client'

import { useMemo } from 'react'
import { Download, Tag, X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { parseScannedAssetCode } from '@/lib/qr-scan-parser'
import { ITEM_STATUS_LABELS, type ItemStatus, type ItemListSearchParams } from '@/features/items/types'
import type { ItemsFilterUpdates } from '@/features/items/hooks/use-items-filter'
import { cn } from '@/lib/utils'

export interface ItemsFilterBarProps {
  searchVal: string
  onSearchChange: (value: string) => void
  onSearchClear: () => void
  onNavigateToItem?: (itemId: string) => void
  params: ItemListSearchParams
  categories: { id: string; name: string }[]
  locations: { id: string; name: string }[]
  onFilterChange: (updates: ItemsFilterUpdates) => void
  onResetFilters: () => void
  folderValuation?: number
  localItemsCount: number
  isExporting: boolean
  onExport: () => void
  userCanWrite?: boolean
  onBatchPrintLocation?: () => void
  className?: string
  searchInputRef?: React.Ref<HTMLInputElement>
}

export function ItemsFilterBar({
  searchVal,
  onSearchChange,
  onSearchClear,
  onNavigateToItem,
  params,
  categories = [],
  locations = [],
  onFilterChange,
  onResetFilters,
  localItemsCount,
  isExporting,
  onExport,
  userCanWrite = false,
  onBatchPrintLocation,
  className,
  searchInputRef,
}: ItemsFilterBarProps) {
  // Compute active chips based on applied filters
  const activeChips = useMemo(() => {
    const chips: { id: string; label: string; value: string; onRemove: () => void }[] = []

    if (params.category_id) {
      const cat = categories.find((c) => c.id === params.category_id)
      chips.push({
        id: 'category',
        label: 'หมวดหมู่',
        value: cat?.name || params.category_id,
        onRemove: () => onFilterChange({ category_id: '' }),
      })
    }

    if (params.status) {
      chips.push({
        id: 'status',
        label: 'สถานะ',
        value: ITEM_STATUS_LABELS[params.status as ItemStatus] || params.status,
        onRemove: () => onFilterChange({ status: '' }),
      })
    }

    if (params.location_id) {
      const loc = locations.find((l) => l.id === params.location_id)
      chips.push({
        id: 'location',
        label: 'สถานที่',
        value: loc?.name || params.location_id,
        onRemove: () => onFilterChange({ location_id: '' }),
      })
    }

    if (params.q && params.q.trim()) {
      chips.push({
        id: 'q',
        label: 'ค้นหา',
        value: `"${params.q.trim()}"`,
        onRemove: () => {
          onSearchClear()
          onFilterChange({ q: '' })
        },
      })
    }

    return chips
  }, [params.category_id, params.status, params.location_id, params.q, categories, locations, onFilterChange, onSearchClear])

  const isCategoryActive = Boolean(params.category_id)
  const isStatusActive = Boolean(params.status)
  const isLocationActive = Boolean(params.location_id)

  return (
    <div className={cn('flex flex-col gap-3 min-w-0', className)} data-testid="items-filter-bar">
      {/* Top Controls Row */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between min-w-0">
        {/* Left Side: Search + Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const parsed = parseScannedAssetCode(searchVal)
              if (parsed.type === 'item_id' && onNavigateToItem) {
                onNavigateToItem(parsed.value)
                return
              }
              onFilterChange({ q: parsed.value })
            }}
            className="flex flex-wrap items-center gap-2 w-full min-w-0"
          >
            {/* Search Input */}
            <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[200px] sm:max-w-xs min-w-0">
              <SearchInput
                ref={searchInputRef}
                value={searchVal}
                onChange={(val) => {
                  const trimmed = val.trim()
                  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                    const parsed = parseScannedAssetCode(trimmed)
                    if (parsed.type === 'item_id' && onNavigateToItem) {
                      onNavigateToItem(parsed.value)
                      return
                    }
                  }
                  onSearchChange(val)
                  onFilterChange({ q: val.trim() })
                }}
                onClear={() => {
                  onSearchClear()
                  onFilterChange({ q: '' })
                }}
                placeholder="ค้นหาชื่อ, เลขครุภัณฑ์, Serial..."
                className="w-full h-9 text-xs"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {/* Category Filter */}
              <select
                name="category_id"
                aria-label="กรองตามหมวดหมู่"
                value={params.category_id ?? ''}
                onChange={(e) => onFilterChange({ category_id: e.target.value })}
                className={cn(
                  'h-9 max-w-[160px] truncate rounded-lg border px-2.5 text-xs font-semibold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs transition-colors',
                  isCategoryActive
                    ? 'border-primary/60 bg-primary/10 text-primary font-bold'
                    : 'border-input bg-card text-card-foreground'
                )}
              >
                <option value="">กรองตามหมวดหมู่</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                name="status"
                aria-label="กรองตามสถานะ"
                value={params.status ?? ''}
                onChange={(e) => onFilterChange({ status: e.target.value })}
                className={cn(
                  'h-9 max-w-[140px] truncate rounded-lg border px-2.5 text-xs font-semibold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs transition-colors',
                  isStatusActive
                    ? 'border-primary/60 bg-primary/10 text-primary font-bold'
                    : 'border-input bg-card text-card-foreground'
                )}
              >
                <option value="">กรองตามสถานะ</option>
                {Object.entries(ITEM_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              {/* Location Filter */}
              <select
                name="location_id"
                aria-label="กรองตามสถานที่"
                value={params.location_id ?? ''}
                onChange={(e) => onFilterChange({ location_id: e.target.value })}
                className={cn(
                  'h-9 max-w-[150px] truncate rounded-lg border px-2.5 text-xs font-semibold focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs transition-colors',
                  isLocationActive
                    ? 'border-primary/60 bg-primary/10 text-primary font-bold'
                    : 'border-input bg-card text-card-foreground'
                )}
              >
                <option value="">กรองตามสถานที่</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>

              {/* Quick Reset Filters Button */}
              {activeChips.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onResetFilters}
                  className="h-9 px-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-colors cursor-pointer shrink-0"
                  title="ล้างตัวกรองทั้งหมด"
                  aria-label="ล้างตัวกรอง"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">ล้างตัวกรอง</span>
                </Button>
              )}

              {/* Batch Print by Location Button */}
              {params.location_id && localItemsCount > 0 && onBatchPrintLocation && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onBatchPrintLocation}
                  className="h-9 px-3 flex items-center gap-1.5 text-xs font-bold border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer shadow-2xs shrink-0"
                  title="พิมพ์ป้ายครุภัณฑ์ทั้งหมดในสถานที่นี้"
                >
                  <Tag className="h-3.5 w-3.5" />
                  <span className="truncate">พิมพ์ป้ายทั้งสถานที่ ({localItemsCount} ชิ้น)</span>
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Right Side: Export Button */}
        {userCanWrite && (
        <div className="flex shrink-0 items-center gap-2.5 justify-end self-end sm:self-auto min-w-0">
          <Button
            type="button"
            onClick={onExport}
            disabled={isExporting}
            className="h-9 rounded-lg border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Download className="h-4 w-4" />
            <span className="truncate">ดาวน์โหลด Excel</span>
          </Button>
        </div>
        )}
      </div>

      {/* Active Filter Chips Strip */}
      {activeChips.length > 0 && (
        <div
          data-testid="active-filter-chips"
          className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 min-w-0"
        >
          <span className="text-xs font-semibold text-muted-foreground select-none">
            ตัวกรองที่ใช้งาน ({activeChips.length}):
          </span>

          {activeChips.map((chip) => (
            <span
              key={chip.id}
              data-testid={`active-chip-${chip.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs transition-all hover:border-border/80 max-w-full"
            >
              <span className="text-muted-foreground text-[11px] font-semibold shrink-0">{chip.label}:</span>
              <span className="font-bold truncate max-w-[200px]">{chip.value}</span>
              <button
                type="button"
                onClick={chip.onRemove}
                className="rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={`ลบตัวกรอง ${chip.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={onResetFilters}
            data-testid="clear-all-filters-button"
            className="inline-flex items-center gap-1 text-xs font-semibold text-destructive hover:text-destructive/80 hover:bg-destructive/10 px-2 py-1 rounded-md transition-colors cursor-pointer ml-1 select-none"
          >
            <RotateCcw className="h-3 w-3" />
            <span>ล้างตัวกรองทั้งหมด</span>
          </button>
        </div>
      )}
    </div>
  )
}
