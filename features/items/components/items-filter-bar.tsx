'use client'

import { ITEM_STATUSES } from '../status'

import { useMemo } from 'react'
import { Activity, Tag, X, RotateCcw, Layers, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { FilterDropdown, type FilterOption } from '@/components/ui/filter-dropdown'
import { parseScannedAssetCode } from '@/lib/qr-scan-parser'
import { ITEM_QUALIFICATION_LABELS, ITEM_STATUS_LABELS, ITEM_TYPE_LABELS, type ItemClassificationCounts, type ItemStatus, type ItemListSearchParams, type ItemQualificationStatus } from '@/features/items/types'
import type { ItemsFilterUpdates } from '@/features/items/hooks/use-items-filter'
import { cn } from '@/lib/utils'

export interface ItemsFilterBarProps {
 assetOnly?: boolean
 materialOnly?: boolean
 centralScope?: boolean
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
 classificationCounts?: ItemClassificationCounts
 isExporting?: boolean
 isLoading?: boolean
 onExport?: () => void
 userCanWrite?: boolean
 onBatchPrintLocation?: () => void
 className?: string
 searchInputRef?: React.Ref<HTMLInputElement>
 rightContent?: React.ReactNode
}

const STATUS_DOT_MAP: Record<string, string> = {
 active: 'bg-emerald-500',
 spare: 'bg-sky-500',
 waiting_repair: 'bg-amber-500',
 damaged: 'bg-rose-500',
 disposed: 'bg-purple-500',
 inactive: 'bg-slate-400',
}

export function ItemsFilterBar({
 assetOnly = false,
 materialOnly = false,
 centralScope = false,
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
 classificationCounts = { all: 0, assets: 0, materials: 0, qualified: 0, belowThreshold: 0, unclassified: 0 },
 isLoading = false,
 onBatchPrintLocation,
 className,
 searchInputRef,
 rightContent,
}: ItemsFilterBarProps) {
 // Compute active chips based on applied filters
 const activeChips = useMemo(() => {
 const chips: { id: string; label: string; value: string; onRemove: () => void }[] = []

 if (!assetOnly && !materialOnly && params.type) {
 chips.push({
 id: 'type',
 label: 'ประเภท',
 value: ITEM_TYPE_LABELS[params.type as keyof typeof ITEM_TYPE_LABELS] ?? params.type,
 onRemove: () => onFilterChange({ type: '' }),
 })
 }

 if (params.qualification) {
 chips.push({
 id: 'qualification',
 label: 'สถานะเกณฑ์',
 value: ITEM_QUALIFICATION_LABELS[params.qualification as ItemQualificationStatus] ?? params.qualification,
 onRemove: () => onFilterChange({ qualification: '' }),
 })
 }

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

 if (!centralScope && (params.is_central === 'true' || params.is_central === '1')) {
 chips.push({
 id: 'is_central',
 label: 'คลัง',
 value: 'ส่วนกลาง',
 onRemove: () => onFilterChange({ is_central: '' }),
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
 }, [assetOnly, materialOnly, centralScope, params.type, params.qualification, params.category_id, params.status, params.location_id, params.is_central, params.q, categories, locations, onFilterChange, onSearchClear])

 const typeOptions: FilterOption[] = useMemo(
 () => [
 { value: 'asset', label: `${ITEM_TYPE_LABELS.asset} (${classificationCounts.assets.toLocaleString('th-TH')})` },
 { value: 'material', label: `${ITEM_TYPE_LABELS.material} (${classificationCounts.materials.toLocaleString('th-TH')})` },
 ],
 [classificationCounts.assets, classificationCounts.materials]
 )

 const qualificationOptions: FilterOption[] = useMemo(
 () => [
 { value: 'qualified', label: `ตามเกณฑ์ (${classificationCounts.qualified.toLocaleString('th-TH')})` },
 { value: 'below_threshold', label: `ต่ำกว่าเกณฑ์ (ต.) (${classificationCounts.belowThreshold.toLocaleString('th-TH')})` },
 { value: 'unclassified', label: `ยังไม่ระบุ (${classificationCounts.unclassified.toLocaleString('th-TH')})` },
 ],
 [classificationCounts.qualified, classificationCounts.belowThreshold, classificationCounts.unclassified]
 )

 const categoryOptions: FilterOption[] = useMemo(
 () => categories.map((cat) => ({ value: cat.id, label: cat.name })),
 [categories]
 )

 const statusOptions: FilterOption[] = useMemo(
 () =>
 ITEM_STATUSES.map((value) => ({
 value,
 label: ITEM_STATUS_LABELS[value],
 colorDot: STATUS_DOT_MAP[value] || 'bg-slate-400',
 })),
 []
 )

 return (
 <div className={cn('flex flex-col gap-2 min-w-0', className)} data-testid="items-filter-bar">
 {/* Top Controls Row */}
 <div className="flex flex-col gap-2 lg:flex-row lg:items-center min-w-0">
 {/* Left Side: Search + Classification Filters + Dropdown Filters */}
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
 <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[160px] sm:max-w-xs min-w-0">
 <SearchInput
 ref={searchInputRef}
 value={searchVal}
 debounceMs={300}
 isLoading={isLoading}
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
 onFilterChange({ q: trimmed })
 }}
 onClear={() => {
 onSearchClear()
 onFilterChange({ q: '' })
 }}
 placeholder={materialOnly ? 'ค้นหาชื่อวัสดุ ขนาด หรือรหัส...' : 'ค้นหาชื่อ, เลขครุภัณฑ์, Serial...'}
 className="w-full h-9 text-xs"
 />
 </div>

 {/* Classification Filters */}
 <div className="flex flex-wrap items-center gap-2" data-testid="classification-filters">
 {!assetOnly && !materialOnly && <FilterDropdown
 label="ประเภท"
 ariaLabel="ประเภท"
 name="type"
 value={params.type ?? ''}
 options={typeOptions}
 onChange={(val) => onFilterChange({ type: val })}
 icon={<Layers className="h-3.5 w-3.5" />}
 allLabel={`ประเภท (${classificationCounts.all.toLocaleString('th-TH')})`}
 />}

 {!materialOnly && <FilterDropdown
 label="เกณฑ์"
 ariaLabel="เกณฑ์"
 name="qualification"
 value={params.qualification ?? ''}
 options={qualificationOptions}
 onChange={(val) => onFilterChange({ qualification: val })}
 icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
 allLabel={`เกณฑ์ (${(classificationCounts.qualified + classificationCounts.belowThreshold + classificationCounts.unclassified).toLocaleString('th-TH')})`}
 />}
 </div>

 {/* Dropdown Filters */}
 <div className="flex flex-wrap items-center gap-2 min-w-0">
 {/* Category Filter */}
 <FilterDropdown
 label="หมวดหมู่"
 ariaLabel="กรองตามหมวดหมู่"
 name="category_id"
 value={params.category_id ?? ''}
 options={categoryOptions}
 onChange={(val) => onFilterChange({ category_id: val })}
 icon={<Tag className="h-3.5 w-3.5" />}
 />

 {/* Status Filter */}
 <FilterDropdown
 label="สถานะ"
 ariaLabel="กรองตามสถานะ"
 name="status"
 value={params.status ?? ''}
 options={statusOptions}
 onChange={(val) => onFilterChange({ status: val })}
 icon={<Activity className="h-3.5 w-3.5" />}
 />

 {/* Batch Print by Location Button */}
 {params.location_id && localItemsCount > 0 && onBatchPrintLocation && (
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={onBatchPrintLocation}
 className="h-9 px-3 flex items-center gap-1.5 text-xs font-bold border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer shadow-2xs shrink-0"
 title="พิมพ์ป้ายครุภัณฑ์ทั้งหมดในสถานที่นี้"
 >
 <Tag className="h-3.5 w-3.5" />
 <span className="truncate">พิมพ์ป้ายทั้งสถานที่ ({localItemsCount} ชิ้น)</span>
 </Button>
 )}
 </div>
 </form>
 </div>

 {/* Right Side: Optional Right Controls */}
 {rightContent && (
 <div className="flex shrink-0 items-center gap-2 justify-end self-end sm:self-auto min-w-0 lg:ml-auto">
 {rightContent}
 </div>
 )}
 </div>

 {/* Active Filter Chips Strip */}
 {activeChips.length > 0 && (
 <div
 data-testid="active-filter-chips"
 className="flex flex-wrap items-center gap-1.5 min-w-0"
 >
 <span className="text-xs font-semibold text-muted-foreground select-none">
 ตัวกรองที่ใช้งาน ({activeChips.length}):
 </span>

 {activeChips.map((chip) => (
 <span
 key={chip.id}
 data-testid={`active-chip-${chip.id}`}
 className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground max-w-full"
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
