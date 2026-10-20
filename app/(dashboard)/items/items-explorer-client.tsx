'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  LayoutGrid,
  List,
  Maximize2,
  Minimize2,
  X,
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

import { useToast } from '@/components/ui/toast'
import { bulkUpdateItems, bulkDeleteItems, getItemsForExport, getMatchingItemIds } from '@/features/items/actions'
import { BulkEditDialog } from '@/features/items/components/bulk-edit-dialog'
import type { BulkItemUpdates } from '@/features/items/bulk-edit'
import type { ActionResponse } from '@/lib/actions-helper'
import { cn } from '@/lib/utils'
import { normalizeItemListSearchParams, ITEMS_PAGE_SIZE } from '@/features/items/list-params'
import { useItemsFilter } from '@/features/items/hooks/use-items-filter'
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'
import { ItemsList } from '@/features/items/components/items-list-view'
import { ItemsGrid } from '@/features/items/components/items-grid-view'
import { Inspector } from '@/features/items/components/item-inspector-drawer'
import { ItemsBulkBar } from '@/features/items/components/items-bulk-bar'
import { ItemsFilterBar } from '@/features/items/components/items-filter-bar'

export function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', total]
  }
  if (current >= total - 3) {
    return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total]
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total]
}

interface ItemsExplorerClientProps {
  items: ItemListRow[]
  total: number
  page?: number
  pageSize?: number
  totalPages?: number
  nextCursor?: string | null
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
  const identity = useMemo(
    () => JSON.stringify([props.userId, normalizeItemListSearchParams(props.params), props.page ?? props.params.page ?? '1']),
    [props.userId, props.params, props.page]
  )
  return <ItemsExplorerSession key={identity} {...props} identity={identity} />
}

function ItemsExplorerSession({
  items,
  total,
  page,
  pageSize = ITEMS_PAGE_SIZE,
  totalPages,
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
  useRealtimeRefresh(['items', 'categories', 'locations', 'units'], {
    pauseOnHidden: true,
    debounceDelay: 300,
    maxWait: 1500,
  })
  const router = useRouter()

  const [currentItems, setCurrentItems] = useState<ItemListRow[]>(items)
  const [currentTotal, setCurrentTotal] = useState<number>(total)
  const [prevPropsItems, setPrevPropsItems] = useState<ItemListRow[]>(items)
  const [prevPropsTotal, setPrevPropsTotal] = useState<number>(total)

  if (items !== prevPropsItems) {
    setPrevPropsItems(items)
    setCurrentItems(items)
  }
  if (total !== prevPropsTotal) {
    setPrevPropsTotal(total)
    setCurrentTotal(total)
  }

  const currentPage = page ?? (Number(params.page || '1') || 1)
  const effectivePageSize = pageSize || 50
  const totalPagesCalculated = totalPages ?? Math.max(1, Math.ceil(currentTotal / effectivePageSize))

  const { toast } = useToast()
  const [inspectedItem, setInspectedItem] = useState<ItemListRow | null>(null)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [selectingAll, setSelectingAll] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [blockingError, setBlockingError] = useState<string | null>(null)

  const filterKey = JSON.stringify([params.q, params.type, params.status, params.category_id, params.location_id, params.sort_by, params.sort_dir, currentPage])
  const currentFilterKey = useRef(filterKey)
  useEffect(() => { currentFilterKey.current = filterKey }, [filterKey])
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey)
  if (filterKey !== previousFilterKey) {
    setPreviousFilterKey(filterKey)
    setSelectedItemIds([])
    setBulkEditOpen(false)
  }
  if (inspectedItem && currentItems.length > 0 && !currentItems.some((item) => item.id === inspectedItem.id)) {
    setInspectedItem(null)
    setIsInspectorOpen(false)
  }

  useEffect(() => {
    if (!isFocusMode) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isFocusMode])
  const {
    searchVal,
    setSearchVal,
    isPending,
    handleFilterChange,
    handlePageChange,
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
    return currentItems
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
  }, [currentItems, selectedItemIds])

  const effectiveSelectedItemId = inspectedItem?.id ?? null
  const selectedItem = useMemo(() => {
    if (!effectiveSelectedItemId) return inspectedItem
    return currentItems.find(item => item.id === effectiveSelectedItemId) ?? inspectedItem
  }, [effectiveSelectedItemId, currentItems, inspectedItem])

  const searchInputRef = useRef<HTMLInputElement>(null)

  const toStickerItem = useCallback((item: ItemListRow): ItemStickerData => ({
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
  }), [])

  const triggerToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    toast(message, type)
  }, [toast])

  const copyReference = useCallback((value: string | null | undefined) => {
    if (!value) return
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(
        () => triggerToast(`คัดลอก "${value}" แล้ว`),
        () => triggerToast('ไม่สามารถคัดลอกลงคลิปบอร์ดได้', 'error')
      )
    } else {
      triggerToast(`คัดลอก "${value}" แล้ว`)
    }
  }, [triggerToast])

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
    return currentItems.reduce((sum, item) => sum + ((item.unit_price ?? 0) * item.quantity), 0)
  }, [currentItems])

  const handleToggleSelectItem = useCallback((id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }, [setSelectedItemIds])

  const currentItemsRef = useRef(currentItems)
  useEffect(() => {
    currentItemsRef.current = currentItems
  }, [currentItems])

  const handleToggleSelectAll = useCallback(() => {
    const pageIds = currentItemsRef.current.map(item => item.id)
    setSelectedItemIds(previous => pageIds.every(id => previous.includes(id))
      ? previous.filter(id => !pageIds.includes(id))
      : [...new Set([...previous, ...pageIds])])
  }, [setSelectedItemIds])

  const handleSelectItem = useCallback((item: ItemListRow) => {
    setInspectedItem(item)
    setIsInspectorOpen(true)
  }, [setInspectedItem, setIsInspectorOpen])

  const handleDoubleClickItem = useCallback((item: ItemListRow) => {
    router.push(`/items/${item.id}`)
  }, [router])

  const handlePrintItem = useCallback((item: ItemListRow) => {
    setSinglePrintItem(toStickerItem(item))
  }, [toStickerItem])

  const handleEditItem = useCallback((item: ItemListRow) => {
    setEditingItem(toItemDetail(item))
    setIsSheetOpen(true)
  }, [])

  const handleBulkDelete = async () => {
    if (typeof window !== 'undefined' && !window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสิ่งของที่เลือกทั้งหมด ${selectedItemIds.length} รายการ?`)) return

    const prevItems = currentItems
    const prevTotal = currentTotal
    const targetIds = [...selectedItemIds]

    setCurrentItems(prev => prev.filter(item => !targetIds.includes(item.id)))
    setCurrentTotal(prev => Math.max(0, prev - targetIds.length))
    setSelectedItemIds([])

    try {
      const res = await deleteBulkAction(targetIds)
      if (!res.success) {
        setCurrentItems(prevItems)
        setCurrentTotal(prevTotal)
        setSelectedItemIds(targetIds)
        setBlockingError(res.message || 'เกิดข้อผิดพลาดในการลบพัสดุ')
      } else {
        triggerToast(res.message || 'ลบเรียบร้อย')
        if (targetIds.length >= prevItems.length && currentPage > 1) {
          handlePageChange(currentPage - 1)
        } else {
          router.refresh()
        }
      }
    } catch {
      setCurrentItems(prevItems)
      setCurrentTotal(prevTotal)
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

  // Global Keyboard Navigation & Focus Guard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Guard against IME composition
      if (e.isComposing) return

      // 2. Element type checks
      const activeElement = document.activeElement as HTMLElement | null
      const tagName = activeElement?.tagName?.toLowerCase()
      const isInputLike =
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        Boolean(activeElement?.isContentEditable) ||
        activeElement?.getAttribute('contenteditable') === 'true'

      // 3. Modal / Dialog / Popover guard
      const isInModalOrDialog = Boolean(
        activeElement?.closest(
          '[role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper], [data-state="open"]'
        )
      )

      const isAnyModalOpen =
        isSheetOpen ||
        bulkEditOpen ||
        isBatchPrintOpen ||
        Boolean(singlePrintItem) ||
        Boolean(locationPrintItems) ||
        Boolean(blockingError)

      // Shortcut: "/" -> Focus Search Input
      if (e.key === '/') {
        if (isInputLike || isInModalOrDialog || isAnyModalOpen) return
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      // If typing in form input or if modal is open, suppress ArrowUp, ArrowDown, Space
      if (isInputLike || isInModalOrDialog || isAnyModalOpen) return

      // Shortcut: "ArrowDown" / "ArrowUp"
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!currentItems.length) return
        e.preventDefault()

        const currentIndex = inspectedItem
          ? currentItems.findIndex((item) => item.id === inspectedItem.id)
          : -1

        let targetIndex: number
        if (e.key === 'ArrowDown') {
          targetIndex = currentIndex === -1 ? 0 : Math.min(currentItems.length - 1, currentIndex + 1)
        } else {
          targetIndex = currentIndex === -1 ? 0 : Math.max(0, currentIndex - 1)
        }

        const nextItem = currentItems[targetIndex]
        if (nextItem) {
          setInspectedItem(nextItem)
          setIsInspectorOpen(true)
        }
        return
      }

      // Shortcut: "Escape" -> Close Focus Mode if active and no modal/inspector open
      if (e.key === 'Escape' && isFocusMode) {
        if (!isAnyModalOpen && !isInspectorOpen) {
          e.preventDefault()
          setIsFocusMode(false)
          return
        }
      }

      // Shortcut: "Space" -> Toggle selection of current inspected/active item
      if (e.key === ' ' || e.key === 'Spacebar') {
        if (tagName === 'button' || tagName === 'a') return
        if (!inspectedItem) return
        e.preventDefault()
        handleToggleSelectItem(inspectedItem.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isFocusMode,
    isInspectorOpen,
    currentItems,
    inspectedItem,
    isSheetOpen,
    bulkEditOpen,
    isBatchPrintOpen,
    singlePrintItem,
    locationPrintItems,
    blockingError,
    handleToggleSelectItem,
  ])

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background text-foreground font-sans">
      {isFocusMode && (
        <div
          data-testid="focus-mode-backdrop"
          onClick={() => setIsFocusMode(false)}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 transition-opacity"
          aria-hidden="true"
        />
      )}
      <div className="flex min-h-0 flex-1 min-w-0 overflow-hidden">
        {/* Main Content Area */}
        <main
          data-testid={isFocusMode ? "focus-mode-container" : undefined}
          className={cn(
            "flex flex-1 flex-col min-w-0 overflow-hidden bg-background",
            isFocusMode && "fixed inset-2 md:inset-4 z-40 rounded-2xl shadow-2xl border border-border bg-card"
          )}
        >
          {/* Dynamic Integrated Header Area */}
          <div className="shrink-0 border-b border-border bg-card px-3 py-2 sm:px-4 md:px-6">
            <div className="flex items-center justify-between gap-3 min-w-0 overflow-x-auto scrollbar-none">
              {/* Left: Dynamic Main Title */}
              <div className="flex shrink-0 items-center min-w-0">
                <h1 className="text-base sm:text-lg font-semibold tracking-tight text-card-foreground leading-none truncate">
                  {params.type === 'material'
                    ? 'รายการทะเบียนวัสดุ'
                    : params.type === 'asset'
                    ? 'รายการทะเบียนครุภัณฑ์'
                    : 'รายการทะเบียนสิ่งของ'}
                </h1>
              </div>

              {/* Middle: Search Input and Dropdown Filters */}
              <div className="flex-1 min-w-0">
                <ItemsFilterBar
                  searchInputRef={searchInputRef}
                  searchVal={searchVal}
                  onSearchChange={setSearchVal}
                  onSearchClear={() => handleFilterChange({ q: '' })}
                  onNavigateToItem={(itemId) => router.push(`/items/${itemId}`)}
                  params={params}
                  categories={categories}
                  locations={locations}
                  onFilterChange={handleFilterChange}
                  onResetFilters={() => {
                    setSearchVal('')
                    handleFilterChange({
                      category_id: '',
                      status: '',
                      location_id: '',
                      q: '',
                    })
                  }}
                  localItemsCount={currentItems.length}
                  isExporting={isExporting}
                  userCanWrite={userCanWrite}
                  onExport={exportToExcel}
                  onBatchPrintLocation={() => {
                    const stickers: ItemStickerData[] = currentItems.map((itm) => ({
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
                />
              </div>

              {/* Right: Item-type tabs + View controls */}
              <div className="flex shrink-0 items-center gap-2">
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
                          'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all select-none',
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
                      'flex h-7 w-7 items-center justify-center rounded-lg transition-all cursor-pointer',
                      viewMode === 'list'
                        ? 'bg-card text-primary font-semibold shadow-xs border border-border/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                    )}
                    title="List view"
                    aria-label="แสดงรายการแบบลิสต์"
                    aria-pressed={viewMode === 'list'}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg transition-all cursor-pointer',
                      viewMode === 'grid'
                        ? 'bg-card text-primary font-semibold shadow-xs border border-border/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                    )}
                    title="Grid view"
                    aria-label="แสดงรายการแบบตาราง"
                    aria-pressed={viewMode === 'grid'}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <div className="h-3.5 w-px bg-border/60 mx-0.5" />
                  <button
                    type="button"
                    onClick={() => setIsFocusMode(!isFocusMode)}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg transition-all cursor-pointer',
                      isFocusMode
                        ? 'bg-card text-primary font-semibold shadow-xs border border-border/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                    )}
                    title={isFocusMode ? 'โฟกัสตาราง' : 'ขยายเต็มหน้าจอ'}
                    aria-label={isFocusMode ? 'โฟกัสตาราง' : 'ขยายเต็มหน้าจอ'}
                    aria-pressed={isFocusMode}
                  >
                    {isFocusMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                  {isFocusMode && (
                    <button
                      type="button"
                      onClick={() => setIsFocusMode(false)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg transition-all cursor-pointer text-muted-foreground hover:text-destructive hover:bg-card/50"
                      title="ปิดโหมดโฟกัส"
                      aria-label="ปิดโหมดโฟกัส"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex-1 min-h-0 min-w-0 flex flex-col">
            {isPending && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/40 backdrop-blur-[1px] transition-all duration-200">
                <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-card shadow-xl border border-border animate-in zoom-in-95 duration-200">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                  <span className="text-xs font-bold text-muted-foreground">กำลังดึงข้อมูล...</span>
                </div>
              </div>
            )}
            <div data-testid="items-scroll" className={cn("flex-1 min-h-0 min-w-0 overflow-auto transition-opacity duration-200", isPending && "opacity-50 pointer-events-none")}>
              {viewMode === 'list' ? (
                <ItemsList
                  items={currentItems}
                  selectedItemId={effectiveSelectedItemId}
                  selectedItemIds={selectedItemIds}
                  onSelect={handleSelectItem}
                  onDoubleClick={handleDoubleClickItem}
                  onToggleSelectItem={handleToggleSelectItem}
                  onToggleSelectAll={handleToggleSelectAll}
                  allLoadedSelected={currentItems.length > 0 && currentItems.every(item => selectedItemIds.includes(item.id))}
                  params={params}
                  onToggleSort={toggleSort}
                  isInspectorOpen={isInspectorOpen}
                  userCanWrite={userCanWrite}
                  onCopy={copyReference}
                  onPrint={handlePrintItem}
                  onEdit={handleEditItem}
                />
              ) : (
                <ItemsGrid
                  items={currentItems}
                  selectedItemId={effectiveSelectedItemId}
                  selectedItemIds={selectedItemIds}
                  onSelect={handleSelectItem}
                  onDoubleClick={handleDoubleClickItem}
                  onToggleSelectItem={handleToggleSelectItem}
                  userCanWrite={userCanWrite}
                  onCopy={copyReference}
                  onPrint={handlePrintItem}
                  onEdit={handleEditItem}
                />
              )}
            </div>
          </div>

          <footer className="flex min-h-12 flex-wrap gap-3 py-2.5 shrink-0 items-center justify-between border-t border-border bg-card px-4 text-xs text-muted-foreground shadow-inner z-10 min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 min-w-0">
              <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-bold text-card-foreground shrink-0">
                {currentTotal > 0
                  ? `แสดง ${(currentPage - 1) * effectivePageSize + 1}–${Math.min(currentPage * effectivePageSize, currentTotal)} จาก ${currentTotal.toLocaleString()} รายการ`
                  : 'แสดง 0 จาก 0 รายการ'}
              </span>
              <span
                data-testid="page-valuation-summary"
                title="มูลค่ารวมของรายการที่แสดงในหน้านี้"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground shrink-0 select-none"
              >
                <span>มูลค่ารวมในหน้านี้:</span>
                <span className="font-extrabold text-primary">฿{folderValuation.toLocaleString()}</span>
              </span>
              {selectedItemIds.length > 0 && (
                <span className="text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 font-bold text-xs shrink-0 select-none">
                  เลือกอยู่ {selectedItemIds.length} รายการ
                </span>
              )}
            </div>

            {/* Server-Side Pagination Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isPending}
                onClick={() => handlePageChange(currentPage - 1)}
                className="h-8 px-2.5 text-xs font-semibold"
                aria-label="หน้าก่อนหน้า"
              >
                ก่อนหน้า
              </Button>

              <div className="flex items-center gap-1">
                {getPageNumbers(currentPage, totalPagesCalculated).map((item, idx) => {
                  if (item === 'ellipsis') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-muted-foreground select-none" aria-hidden="true">
                        …
                      </span>
                    )
                  }
                  const isCurrent = item === currentPage
                  return (
                    <button
                      key={item}
                      type="button"
                      disabled={isPending}
                      onClick={() => handlePageChange(item)}
                      aria-current={isCurrent ? 'page' : undefined}
                      aria-label={`หน้า ${item}`}
                      className={cn(
                        'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors cursor-pointer select-none',
                        isCurrent
                          ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {item}
                    </button>
                  )
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPagesCalculated || isPending}
                onClick={() => handlePageChange(currentPage + 1)}
                className="h-8 px-2.5 text-xs font-semibold"
                aria-label="หน้าถัดไป"
              >
                ถัดไป
              </Button>
            </div>
          </footer>
        </main>

        {/* Adaptive Detail Inspector: Docked split-pane on desktop, slide-over drawer on mobile */}
        <Inspector
          onOpenDetails={() => {}}
          isOpen={isInspectorOpen}
          mode={isFocusMode ? 'drawer' : 'auto'}
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
      </div>

      {bulkEditOpen && (
        <BulkEditDialog
          count={selectedItemIds.length}
          locations={locations}
          categories={categories}
          units={units}
          onClose={() => setBulkEditOpen(false)}
          onSave={async (updates) => {
            const prevItems = currentItems
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
            setCurrentItems(prev => prev.map(item => selectedItemIds.includes(item.id) ? { ...item, ...patch } : item))
            try {
              const result = await bulkUpdateAction(selectedItemIds, updates)
              if (!result.success) {
                setCurrentItems(prevItems)
              }
              return result
            } catch (err) {
              setCurrentItems(prevItems)
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
                <AlertCircle className="size-7" />
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
