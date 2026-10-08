'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Download,
  LayoutGrid,
  List,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ITEM_STATUS_LABELS,
  ITEM_TYPE_LABELS,
  ItemListRow,
  ItemType,
  ItemListSearchParams,
  ItemDetail,
} from '@/features/items/types'
import dynamic from 'next/dynamic'

const NewItemSheet = dynamic(
  () => import('@/features/items/components/new-item-sheet').then((mod) => mod.NewItemSheet),
  { ssr: false }
)

import { AssetTagModal } from '@/features/items/components/item-list-client'
import type { ItemStickerData } from '@/components/ui/asset-tag-modal'

import { SearchInput } from '@/components/ui/search-input'
import { useToast } from '@/components/ui/toast'
import { bulkUpdateItems, bulkDeleteItems, getItemsForExport, getMatchingItemIds } from '@/features/items/actions'
import { BulkEditDialog } from '@/features/items/components/bulk-edit-dialog'
import type { BulkItemUpdates } from '@/features/items/bulk-edit'
import type { ActionResponse } from '@/lib/actions-helper'
import { cn } from '@/lib/utils'
import { normalizeItemListSearchParams } from '@/features/items/list-params'
import { useItemWindow } from '@/features/items/use-item-window'
import { useItemsFilter } from '@/features/items/hooks/use-items-filter'
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'
import { ItemsList } from '@/features/items/components/items-list-view'
import { ItemsGrid } from '@/features/items/components/items-grid-view'
import { Inspector } from '@/features/items/components/item-inspector-drawer'
import { ItemsBulkBar } from '@/features/items/components/items-bulk-bar'

interface ItemsExplorerClientProps {
  items: ItemListRow[]
  total: number
  nextCursor: string | null
  userId: string
  params: ItemListSearchParams & { new?: string }
  userCanWrite: boolean
  userCanDelete: boolean
  locations: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  units: { id: string; name: string }[]
  bulkUpdateAction?: (ids: string[], updates: BulkItemUpdates) => Promise<ActionResponse>
  bulkDeleteAction?: (ids: string[]) => Promise<ActionResponse>
  bulkHardDeleteAction?: (ids: string[]) => Promise<ActionResponse>
}

function toItemDetail(item: ItemListRow): ItemDetail {
  return {
    ...item,
    brand: item.brand ?? null,
    model: item.model ?? null,
    note: item.note ?? null,
    image_url: item.image_url ?? null,
    created_at: item.updated_at,
  }
}

export function ItemsExplorerClient(props: ItemsExplorerClientProps) {
  const identity = useMemo(() => JSON.stringify([props.userId, normalizeItemListSearchParams(props.params)]), [props.userId, props.params])
  return <ItemsExplorerSession key={identity} {...props} identity={identity} />
}

function ItemsExplorerSession({
  items,
  total,
  nextCursor,
  identity,
  params,
  userCanWrite,
  userCanDelete,
  locations = [],
  categories = [],
  units = [],
  bulkUpdateAction = bulkUpdateItems,
  bulkDeleteAction,
  bulkHardDeleteAction,
}: ItemsExplorerClientProps & { identity: string }) {
  const deleteBulkAction = bulkDeleteAction ?? bulkHardDeleteAction ?? bulkDeleteItems
  useRealtimeRefresh(['items', 'categories', 'locations', 'units'])
  const router = useRouter()
  const {
    attachScroll,
    optimisticUpdate,
    optimisticDelete,
    rollback,
    snapshot,
    save: saveWindow,
    ...windowed
  } = useItemWindow(identity, params, { items, total, nextCursor })
  const localItems = windowed.loaded

  const { toast } = useToast()
  const [inspectedItem, setInspectedItem] = useState<ItemListRow | null>(null)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [selectingAll, setSelectingAll] = useState(false)
  const filterKey = JSON.stringify([params.q, params.type, params.status, params.category_id, params.location_id, params.sort_by, params.sort_dir])
  const currentFilterKey = useRef(filterKey)
  useEffect(() => { currentFilterKey.current = filterKey }, [filterKey])
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey)
  if (filterKey !== previousFilterKey) {
    setPreviousFilterKey(filterKey)
    setSelectedItemIds([])
    setBulkEditOpen(false)
  }
  const { view: viewMode, setView: setViewMode } = windowed
  const [blockingError, setBlockingError] = useState<string | null>(null)
  const {
    searchVal,
    setSearchVal,
    isPending,
    handleFilterChange,
    toggleSort,
    buildHref,
  } = useItemsFilter(params)

  const [isExporting, setIsExporting] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ItemDetail | null>(null)
  const [isBatchPrintOpen, setIsBatchPrintOpen] = useState(false)
  const [singlePrintItem, setSinglePrintItem] = useState<ItemStickerData | null>(null)
  const [locationPrintItems, setLocationPrintItems] = useState<ItemStickerData[] | null>(null)

  const selectedItemsData = useMemo(() => {
    const selectedSet = new Set(selectedItemIds)
    return localItems
      .filter((item) => selectedSet.has(item.id))
      .map((item) => ({
        id: item.id,
        item_name: item.item_name,
        asset_no: item.asset_no,
        serial_no: item.serial_no,
        brand: item.brand,
        model: item.model,
        location_name: item.location?.name,
        category_name: item.category?.name,
        responsible_person: item.responsible_person,
        unit_price: item.unit_price,
      }))
  }, [localItems, selectedItemIds])

  const effectiveSelectedItemId = inspectedItem?.id ?? null
  const selectedItem = useMemo(() => {
    if (!effectiveSelectedItemId) return inspectedItem
    return localItems.find(item => item.id === effectiveSelectedItemId) ?? inspectedItem
  }, [effectiveSelectedItemId, localItems, inspectedItem])

  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    toast(message, type)
  }

  const copyReference = (value: string | null | undefined) => {
    if (!value) return
    navigator.clipboard.writeText(value)
    triggerToast(`คัดลอก "${value}" แล้ว`)
  }

  const exportToExcel = async () => {
    if (isExporting) return
    setIsExporting(true)
    triggerToast('กำลังเตรียมข้อมูลสำหรับส่งออก...', 'info')
    try {
      const { default: ExcelJS } = await import('exceljs')
      triggerToast('กำลังดึงข้อมูลพัสดุจากระบบ...', 'info')
      const allItems = await getItemsForExport(params)
      if (!allItems || allItems.length === 0) {
        setBlockingError('ไม่พบข้อมูลที่จะส่งออก')
        setIsExporting(false)
        return
      }

      triggerToast(`กำลังจัดทำไฟล์ Excel (${allItems.length.toLocaleString()} รายการ)...`, 'info')
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('ทะเบียนสิ่งของ')

      worksheet.columns = [
        { header: 'ชื่อสิ่งของ', key: 'item_name', width: 25 },
        { header: 'ประเภท', key: 'item_type', width: 15 },
        { header: 'หมวดหมู่', key: 'category_name', width: 15 },
        { header: 'จำนวน', key: 'quantity', width: 10 },
        { header: 'ราคาต่อหน่วย', key: 'unit_price', width: 14 },
        { header: 'หน่วยนับ', key: 'unit_name', width: 10 },
        { header: 'เลขครุภัณฑ์', key: 'asset_no', width: 20 },
        { header: 'Serial Number', key: 'serial_no', width: 20 },
        { header: 'ยี่ห้อ', key: 'brand', width: 15 },
        { header: 'รุ่น', key: 'model', width: 15 },
        { header: 'สถานที่', key: 'location_name', width: 20 },
        { header: 'ผู้รับผิดชอบ', key: 'responsible_person', width: 20 },
        { header: 'สถานะ', key: 'status', width: 15 },
        { header: 'หมายเหตุ', key: 'note', width: 25 },
      ]

      allItems.forEach((item) => {
        worksheet.addRow({
          item_name: item.item_name,
          item_type: ITEM_TYPE_LABELS[item.item_type] || item.item_type,
          category_name: item.category?.name || '-',
          quantity: item.quantity,
          unit_price: item.unit_price ?? 0,
          unit_name: item.unit?.name || '-',
          asset_no: item.asset_no || '-',
          serial_no: item.serial_no || '-',
          brand: item.brand || '-',
          model: item.model || '-',
          location_name: item.location?.name || '-',
          responsible_person: item.responsible_person || '-',
          status: ITEM_STATUS_LABELS[item.status] || item.status,
          note: item.note || '-',
        })
      })

      // Format headers
      worksheet.getRow(1).font = { bold: true }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      }

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const typeLabel = params.type ? `_${ITEM_TYPE_LABELS[params.type as ItemType] || params.type}` : ''
      a.download = `inventory_registry${typeLabel}_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      triggerToast('ดาวน์โหลดไฟล์เรียบร้อยแล้ว')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setBlockingError('เกิดข้อผิดพลาดขณะส่งออกข้อมูล: ' + errMsg)
    } finally {
      setIsExporting(false)
    }
  }

  const folderValuation = useMemo(() => {
    return localItems.reduce((sum, item) => sum + ((item.unit_price ?? 0) * item.quantity), 0)
  }, [localItems])

  const handleToggleSelectItem = useCallback((id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }, [])

  const localItemsRef = useRef(localItems)
  useEffect(() => {
    localItemsRef.current = localItems
  }, [localItems])

  const handleToggleSelectAll = useCallback(() => {
    const pageIds = localItemsRef.current.map(item => item.id)
    setSelectedItemIds(previous => pageIds.every(id => previous.includes(id))
      ? previous.filter(id => !pageIds.includes(id))
      : [...new Set([...previous, ...pageIds])])
  }, [])

  const handleSelectItem = useCallback((item: ItemListRow) => {
    setInspectedItem(item)
    setIsInspectorOpen(true)
  }, [])

  const handleDoubleClickItem = useCallback((item: ItemListRow) => {
    saveWindow()
    router.push(`/items/${item.id}`)
  }, [router, saveWindow])

  const handleBulkDelete = async () => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสิ่งของที่เลือกทั้งหมด ${selectedItemIds.length} รายการ?`)) return

    const snap = snapshot()
    optimisticDelete(selectedItemIds)
    const targetIds = [...selectedItemIds]
    setSelectedItemIds([])

    try {
      const res = await deleteBulkAction(targetIds)
      if (!res.success) {
        rollback(snap)
        setSelectedItemIds(targetIds)
        setBlockingError(res.message || 'เกิดข้อผิดพลาดในการลบพัสดุ')
      } else {
        triggerToast(res.message || 'ลบเรียบร้อย')
        router.refresh()
      }
    } catch {
      rollback(snap)
      setSelectedItemIds(targetIds)
      setBlockingError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่')
    }
  }

  const handleSelectAllMatching = async () => {
    setSelectingAll(true)
    try {
      const result = await getMatchingItemIds(params)
      if (currentFilterKey.current !== filterKey) return
      if (result.success && result.data) setSelectedItemIds(result.data)
      else setBlockingError(result.message || 'เลือกรายการไม่สำเร็จ')
    } catch { setBlockingError('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่') }
    finally { setSelectingAll(false) }
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background text-foreground font-sans">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Main Content Area */}
        <main className="flex w-full flex-1 flex-col min-w-0 overflow-hidden bg-background">
          {/* Dynamic Integrated Header Area */}
          <div className="shrink-0 border-b border-border bg-card px-4 py-5 sm:px-6 md:px-8">
            {/* Row 1: Title (Left) + Segmented Tabs (Center/Integrated) + View Mode Toggle (Right) */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col min-w-0">
                {/* Dynamic Main Title */}
                <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-card-foreground leading-snug">
                  {params.type === 'material'
                    ? 'รายการทะเบียนวัสดุ'
                    : params.type === 'asset'
                    ? 'รายการทะเบียนครุภัณฑ์'
                    : 'รายการทะเบียนสิ่งของ'}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">ค้นหา ตรวจสอบ และจัดการข้อมูลทะเบียนพัสดุ</p>
              </div>

              {/* Segmented Type Switcher & View Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Segmented Pill Tabs */}
                <nav aria-label="ประเภทพัสดุ" className="flex items-center rounded-xl border border-border bg-muted/60 p-1 shadow-2xs">
                  {[
                    { value: '', label: 'ทั้งหมด' },
                    { value: 'asset', label: 'ครุภัณฑ์' },
                    { value: 'material', label: 'วัสดุ' }
                  ].map((type) => {
                    const isActive = (params.type || '') === type.value
                    return (
                      <Link
                        key={type.value}
                        href={buildHref({ type: type.value, category_id: '', page: '1' })}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all select-none',
                          isActive
                            ? 'bg-card text-foreground font-semibold shadow-xs border border-border/50'
                            : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                        )}
                      >
                        <span>{type.label}</span>
                      </Link>
                    )
                  })}
                </nav>

                {/* View Mode Toggle */}
                <div className="flex shrink-0 items-center rounded-xl border border-border bg-muted/60 p-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg transition-all cursor-pointer',
                      viewMode === 'list'
                        ? 'bg-card text-primary font-semibold shadow-xs border border-border/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                    )}
                    title="List view"
                    aria-label="แสดงรายการแบบลิสต์"
                    aria-pressed={viewMode === 'list'}
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg transition-all cursor-pointer',
                      viewMode === 'grid'
                        ? 'bg-card text-primary font-semibold shadow-xs border border-border/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                    )}
                    title="Grid view"
                    aria-label="แสดงรายการแบบตาราง"
                    aria-pressed={viewMode === 'grid'}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Action Bar (Bottom Row) */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4">
              {/* Left Side: Search + Category + Status Filters */}
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleFilterChange({ q: searchVal })
                  }}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto flex-1 min-w-0"
                >
                  {/* Search Box */}
                  <div className="flex items-center gap-2 w-full sm:w-auto flex-1 min-w-0">
                    <SearchInput
                      value={searchVal}
                      onChange={(val) => {
                        setSearchVal(val)
                        handleFilterChange({ q: val.trim() })
                      }}
                      onClear={() => handleFilterChange({ q: '' })}
                      placeholder="ค้นหาชื่อ, เลขครุภัณฑ์, Serial..."
                      className="w-full sm:w-80"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Category Filter */}
                    <select
                      name="category_id"
                      aria-label="กรองตามหมวดหมู่"
                      value={params.category_id ?? ''}
                      onChange={(e) => handleFilterChange({ category_id: e.target.value })}
                      className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-card-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
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
                      onChange={(e) => handleFilterChange({ status: e.target.value })}
                      className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-card-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
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
                      onChange={(e) => handleFilterChange({ location_id: e.target.value })}
                      className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-card-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
                    >
                      <option value="">กรองตามสถานที่</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>

                    {/* Batch Print by Location Button */}
                    {params.location_id && localItems.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const stickers: ItemStickerData[] = localItems.map((itm) => ({
                            id: itm.id,
                            item_name: itm.item_name,
                            asset_no: itm.asset_no,
                            serial_no: itm.serial_no,
                            brand: itm.brand,
                            model: itm.model,
                            location_name: itm.location?.name,
                            category_name: itm.category?.name,
                            responsible_person: itm.responsible_person,
                            unit_price: itm.unit_price,
                          }))
                          setLocationPrintItems(stickers)
                        }}
                        className="h-9 px-3 flex items-center gap-1.5 text-xs font-bold border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer shadow-2xs"
                        title="พิมพ์ป้ายครุภัณฑ์ทั้งหมดในสถานที่นี้"
                      >
                        <Tag className="h-3.5 w-3.5" />
                        <span>พิมพ์ป้ายทั้งสถานที่ ({localItems.length} ชิ้น)</span>
                      </Button>
                    )}
                  </div>
                </form>
              </div>

              {/* Right Side: Export Button */}
              <div className="flex shrink-0 items-center justify-end sm:mt-0">
                <Button
                  type="button"
                  onClick={exportToExcel}
                  disabled={isExporting}
                  className="h-9 rounded-lg border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>ดาวน์โหลด Excel</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="relative flex-1 min-h-0 flex flex-col">
            {isPending && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/40 backdrop-blur-[1px] transition-all duration-200">
                <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card shadow-xl border border-border animate-in zoom-in-95 duration-200">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                  <span className="text-xs font-bold text-muted-foreground">กำลังดึงข้อมูล...</span>
                </div>
              </div>
            )}
            <div ref={attachScroll} data-testid="items-scroll" className={cn("flex-1 min-h-0 overflow-auto transition-opacity duration-200", isPending && "opacity-50 pointer-events-none")}>
              {viewMode === 'list' ? (
                <ItemsList
                  items={windowed.slots}
                  topSpace={windowed.topSpace}
                  bottomSpace={windowed.bottomSpace}
                  selectedItemId={effectiveSelectedItemId}
                  selectedItemIds={selectedItemIds}
                  onSelect={handleSelectItem}
                  onDoubleClick={handleDoubleClickItem}
                  onToggleSelectItem={handleToggleSelectItem}
                  onToggleSelectAll={handleToggleSelectAll}
                  allLoadedSelected={localItems.length > 0 && localItems.every(item => selectedItemIds.includes(item.id))}
                  params={params}
                  onToggleSort={toggleSort}
                />
              ) : (
                <ItemsGrid
                  columns={windowed.columns}
                  items={windowed.slots}
                  topSpace={windowed.topSpace}
                  bottomSpace={windowed.bottomSpace}
                  selectedItemId={effectiveSelectedItemId}
                  selectedItemIds={selectedItemIds}
                  onSelect={handleSelectItem}
                  onDoubleClick={handleDoubleClickItem}
                  onToggleSelectItem={handleToggleSelectItem}
                />
              )}
            </div>
          </div>

          <footer className="flex min-h-10 flex-wrap gap-2 py-2 shrink-0 items-center justify-between border-t border-border bg-card px-4 text-xs text-muted-foreground shadow-inner z-10">
            <div className="flex items-center gap-4">
              <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-bold text-card-foreground">
                ถึง {windowed.store.count} / {windowed.state.total ?? total} รายการ (โหลดอยู่ {localItems.length})
              </span>
              <span className="text-muted-foreground font-semibold hidden md:inline">
                มูลค่ารายการที่โหลดอยู่: <span className="text-primary font-black">฿{folderValuation.toLocaleString()}</span>
              </span>
              {selectedItemIds.length > 0 && (
                <span className="text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 font-bold text-xs">
                  เลือกอยู่ {selectedItemIds.length} รายการ
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span role="status" aria-live="polite">{windowed.state.error ?? (windowed.state.loading ? 'กำลังโหลด...' : !windowed.store.hasMore ? 'ครบทุกข้อมูลแล้ว' : '')}</span>
              {(windowed.state.error || windowed.store.hasMore) && <Button variant="outline" disabled={windowed.state.loading} onClick={() => void (windowed.state.error ? windowed.store.retry() : windowed.store.loadMore())}>{windowed.state.error ? 'ลองใหม่' : 'โหลดเพิ่มเติม'}</Button>}
            </div>
          </footer>
        </main>
      </div>

      {/* Slide-Over Detail Drawer (Inspector Sheet) */}
      <Inspector
        onOpenDetails={saveWindow}
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        item={selectedItem}
        userCanWrite={userCanWrite}
        userCanDelete={userCanDelete}
        onCopy={copyReference}
        onPrint={(itemData) => setSinglePrintItem(itemData)}
        onEdit={(itemToEdit) => {
          setEditingItem(toItemDetail(itemToEdit))
          setIsSheetOpen(true)
        }}
      />

      {bulkEditOpen && (
        <BulkEditDialog
          count={selectedItemIds.length}
          locations={locations}
          categories={categories}
          units={units}
          onClose={() => setBulkEditOpen(false)}
          onSave={async (updates) => {
            const snap = snapshot()
            const patch: Partial<ItemListRow> = {}
            if (updates.status !== undefined) {
              patch.status = updates.status
            }
            if (updates.responsible_person !== undefined) {
              patch.responsible_person = updates.responsible_person || null
            }
            if (updates.location_id !== undefined) {
              const loc = locations.find((l) => l.id === updates.location_id)
              patch.location = loc ? { id: loc.id, name: loc.name } : { id: updates.location_id, name: '' }
            }
            if (updates.category_id !== undefined) {
              const cat = categories.find((c) => c.id === updates.category_id)
              patch.category = cat ? { id: cat.id, name: cat.name } : { id: updates.category_id, name: '' }
            }
            if (updates.unit_id !== undefined) {
              const u = units.find((unit) => unit.id === updates.unit_id)
              patch.unit = u ? { id: u.id, name: u.name } : { id: updates.unit_id, name: '' }
            }
            optimisticUpdate(selectedItemIds, patch)
            try {
              const result = await bulkUpdateAction(selectedItemIds, updates)
              if (!result.success) {
                rollback(snap)
              }
              return result
            } catch (err) {
              rollback(snap)
              throw err
            }
          }}
          onSaved={(message) => {
            triggerToast(message)
            setBulkEditOpen(false)
            setSelectedItemIds([])
            router.refresh()
          }}
        />
      )}

      {/* Floating Bulk Actions Toolbar */}
      <ItemsBulkBar
        selectedCount={selectedItemIds.length}
        total={total}
        userCanWrite={userCanWrite}
        userCanDelete={userCanDelete}
        selectingAll={selectingAll}
        canPrintBatch={selectedItemsData.length === selectedItemIds.length}
        onBulkEdit={() => setBulkEditOpen(true)}
        onSelectAllMatching={handleSelectAllMatching}
        onBatchPrint={() => setIsBatchPrintOpen(true)}
        onBulkDelete={handleBulkDelete}
        onClearSelection={() => setSelectedItemIds([])}
      />

      <AssetTagModal
        isOpen={isBatchPrintOpen || Boolean(singlePrintItem) || Boolean(locationPrintItems)}
        onClose={() => {
          setIsBatchPrintOpen(false)
          setSinglePrintItem(null)
          setLocationPrintItems(null)
        }}
        item={singlePrintItem ?? undefined}
        items={locationPrintItems ?? (isBatchPrintOpen ? selectedItemsData : undefined)}
      />

      {/* Blocking Error Modal */}
      {blockingError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <span className="material-symbols-outlined text-[28px]">error</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-card-foreground">การดำเนินงานล้มเหลว</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{blockingError}</p>
              </div>
              <button
                type="button"
                onClick={() => setBlockingError(null)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center cursor-pointer"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Item Sheet */}
      <NewItemSheet
        open={isSheetOpen}
        item={editingItem}
        onClose={() => {
          setIsSheetOpen(false)
          setEditingItem(null)
        }}
        onSuccess={() => {
          setIsSheetOpen(false)
          setEditingItem(null)
          triggerToast(editingItem ? 'บันทึกการแก้ไขเรียบร้อยแล้ว' : 'เพิ่มสิ่งของเรียบร้อยแล้ว')
          router.refresh()
        }}
        categories={categories}
        locations={locations}
        units={units}
      />
    </div>
  )
}
