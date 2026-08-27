'use client'

import React, { useMemo, useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Check,
  Copy,
  Download,
  Edit,
  ExternalLink,
  FileText,
  LayoutGrid,
  List,
  MapPin,
  Package,
  StickyNote,
  User,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { ZoomableImage } from '@/components/ui/zoomable-image'
import {
  ITEM_STATUS_LABELS,
  ITEM_TYPE_LABELS,
  ItemListRow,
  ItemStatus,
  ItemType,
  ItemListSearchParams,
  ItemDetail,
} from '@/features/items/types'
import dynamic from 'next/dynamic'
import { DeleteItemButton } from '@/features/items/components/delete-item-button'

const NewItemSheet = dynamic(
  () => import('@/features/items/components/new-item-sheet').then((mod) => mod.NewItemSheet),
  { ssr: false }
)

import { AssetTagModal } from '@/features/items/components/item-list-client'
import type { ItemStickerData } from '@/components/ui/asset-tag-modal'

import { SearchInput } from '@/components/ui/search-input'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/components/ui/toast'
import {
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableCell
} from '@/components/ui/data-table'
import { bulkUpdateItems, bulkHardDeleteItems, getItemsForExport } from '@/features/items/actions'
import { cn } from '@/lib/utils'
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'
import { AssetNumberTemplate } from '@/features/asset-numbers/types'

interface ItemsExplorerClientProps {
  items: ItemListRow[]
  total: number
  page: number
  totalPages: number
  params: ItemListSearchParams & { new?: string }
  userCanWrite: boolean
  userCanDelete: boolean
  locations: { id: string; name: string }[]
  categories: { id: string; name: string }[]
  units: { id: string; name: string }[]
  assetNumberTemplates?: AssetNumberTemplate[]
}

type ViewMode = 'list' | 'grid'

const typeIcons: Record<ItemType, React.ReactNode> = {
  asset: <Package className="h-4 w-4 text-blue-600" />,
  material: <FileText className="h-4 w-4 text-emerald-600" />,
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

export function ItemsExplorerClient({
  items,
  total,
  page,
  totalPages,
  params,
  userCanWrite,
  userCanDelete,
  locations,
  categories,
  units,
  assetNumberTemplates = [],
}: ItemsExplorerClientProps) {
  useRealtimeRefresh(['items', 'categories', 'locations', 'units'])
  const router = useRouter()
  const [localItems, setLocalItems] = useState<ItemListRow[]>(items)
  const [prevItems, setPrevItems] = useState<ItemListRow[]>(items)

  // Keep localItems in sync when server re-fetches (router.refresh)
  if (items !== prevItems) {
    setPrevItems(items)
    setLocalItems(items)
  }

  const searchParams = useSearchParams()
  const newParam = searchParams.get('new')

  const { toast } = useToast()
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [blockingError, setBlockingError] = useState<string | null>(null)
  const [searchVal, setSearchVal] = useState(params.q ?? '')
  const [prevQ, setPrevQ] = useState(params.q ?? '')
  const [isPending, startTransition] = useTransition()
  const [isExporting, setIsExporting] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ItemDetail | null>(null)
  const [isBatchPrintOpen, setIsBatchPrintOpen] = useState(false)
  const [singlePrintItem, setSinglePrintItem] = useState<ItemStickerData | null>(null)
  const [lastNewParam, setLastNewParam] = useState<string | null>(null)

  const selectedItemsData = useMemo(() => {
    return localItems
      .filter((item) => selectedItemIds.includes(item.id))
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

  // Reactively open sheet when URL query param changes during render
  if (newParam !== lastNewParam) {
    setLastNewParam(newParam)
    if (newParam === 'true') {
      setIsSheetOpen(true)
    }
  }

  // URL clean up side-effect (runs after render commit)
  React.useEffect(() => {
    if (newParam === 'true') {
      const current = new URLSearchParams(window.location.search)
      if (current.has('new')) {
        current.delete('new')
        const newSearch = current.toString()
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '')
        window.history.replaceState(null, '', newUrl)
      }
    }
  }, [newParam])


  const currentQ = params.q ?? ''
  if (currentQ !== prevQ) {
    setPrevQ(currentQ)
    setSearchVal(currentQ)
  }

  const handleFilterChange = (updates: {
    q?: string
    type?: string
    status?: string
    category_id?: string
    location_id?: string
    page?: string
    sort_by?: string
    sort_dir?: string
  }) => {
    const query = new URLSearchParams()
    
    const newQ = updates.q !== undefined ? updates.q : searchVal
    const newType = updates.type !== undefined ? updates.type : (params.type ?? '')
    const newStatus = updates.status !== undefined ? updates.status : (params.status ?? '')
    const newCategory = updates.category_id !== undefined ? updates.category_id : (params.category_id ?? '')
    const newLocation = updates.location_id !== undefined ? updates.location_id : (params.location_id ?? '')
    const newSortBy = updates.sort_by !== undefined ? updates.sort_by : (params.sort_by ?? '')
    const newSortDir = updates.sort_dir !== undefined ? updates.sort_dir : (params.sort_dir ?? '')
    
    if (newQ) query.set('q', newQ)
    if (newType) query.set('type', newType)
    if (newStatus) query.set('status', newStatus)
    if (newCategory) query.set('category_id', newCategory)
    if (newLocation) query.set('location_id', newLocation)
    if (newSortBy) query.set('sort_by', newSortBy)
    if (newSortDir) query.set('sort_dir', newSortDir)
    
    if (updates.page) {
      query.set('page', updates.page)
    } else if (updates.sort_by || updates.sort_dir) {
      if (params.page) query.set('page', params.page)
    } else {
      query.set('page', '1')
    }
    
    startTransition(() => {
      router.push(`/items?${query.toString()}`)
    })
  }

  const toggleSort = (field: string) => {
    const currentField = params.sort_by || 'updated_at'
    const currentDir = params.sort_dir || 'desc'
    
    let nextDir: 'asc' | 'desc' = 'asc'
    if (currentField === field) {
      nextDir = currentDir === 'asc' ? 'desc' : 'asc'
    } else {
      nextDir = field === 'item_name' || field === 'item_type' ? 'asc' : 'desc'
    }
    
    handleFilterChange({ sort_by: field, sort_dir: nextDir })
  }

  const effectiveSelectedItemId = localItems.some((item) => item.id === selectedItemId)
    ? selectedItemId
    : localItems[0]?.id ?? null
  const selectedItem = localItems.find((item) => item.id === effectiveSelectedItemId) ?? null

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

  const buildHref = (overrides: Partial<{ q: string; type: string; status: string; page: string; category_id: string; location_id: string }>) => {
    const query = new URLSearchParams()
    const next = { ...params, ...overrides }

    if (next.q) query.set('q', next.q)
    if (next.type) query.set('type', next.type)
    if (next.status) query.set('status', next.status)
    if (next.category_id) query.set('category_id', next.category_id)
    if (next.location_id) query.set('location_id', next.location_id)
    if (next.page) query.set('page', next.page)

    const serialized = query.toString()
    return serialized ? `/items?${serialized}` : '/items'
  }

  const buildPageHref = (pageNumber: number) => buildHref({ page: String(pageNumber) })



  const folderValuation = useMemo(() => {
    return localItems.reduce((sum, item) => sum + ((item.unit_price ?? 0) * item.quantity), 0)
  }, [localItems])

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleToggleSelectAll = () => {
    if (selectedItemIds.length === localItems.length) {
      setSelectedItemIds([])
    } else {
      setSelectedItemIds(localItems.map((item) => item.id))
    }
  }

  const handleSelectItem = (item: ItemListRow) => {
    setSelectedItemId(item.id)
    setIsInspectorOpen(true)
  }

  const handleDoubleClickItem = (item: ItemListRow) => {
    router.push(`/items/${item.id}`)
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background text-foreground font-sans">

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Main Content Area */}
        <main className="flex w-full flex-1 flex-col min-w-0 overflow-hidden bg-background">
          {/* Dynamic Integrated Header Area */}
          <div className="shrink-0 border-b border-border bg-card px-6 py-5 md:px-8">
            {/* Row 1: Title (Left) & View Mode Toggle (Right) */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col min-w-0">
                {/* Dynamic Main Title */}
                <h2 className="text-lg md:text-xl font-bold tracking-tight text-card-foreground leading-tight">
                  {params.type === 'material'
                    ? 'รายการทะเบียนวัสดุ'
                    : params.type === 'asset'
                    ? 'รายการทะเบียนครุภัณฑ์'
                    : 'รายการทะเบียนสิ่งของ'}
                </h2>
              </div>

              {/* View Mode Toggle */}
              <div className="flex shrink-0 items-center rounded-lg border border-border bg-muted p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'flex min-h-11 min-w-11 items-center justify-center rounded-md transition-all cursor-pointer',
                    viewMode === 'list' ? 'bg-card text-primary shadow-2xs' : 'text-muted-foreground hover:text-card-foreground'
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
                    'flex min-h-11 min-w-11 items-center justify-center rounded-md transition-all cursor-pointer',
                    viewMode === 'grid' ? 'bg-card text-primary shadow-2xs' : 'text-muted-foreground hover:text-card-foreground'
                  )}
                  title="Grid view"
                  aria-label="แสดงรายการแบบตาราง"
                  aria-pressed={viewMode === 'grid'}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
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
            <div className={cn("flex-1 min-h-0 flex flex-col transition-opacity duration-200", isPending && "opacity-50 pointer-events-none")}>
              {viewMode === 'list' ? (
                <ItemsList
                  items={localItems}
                  selectedItemId={effectiveSelectedItemId}
                  selectedItemIds={selectedItemIds}
                  onSelect={handleSelectItem}
                  onDoubleClick={handleDoubleClickItem}
                  onToggleSelectItem={handleToggleSelectItem}
                  onToggleSelectAll={handleToggleSelectAll}
                  params={params}
                  onToggleSort={toggleSort}
                />
              ) : (
                <ItemsGrid
                  items={localItems}
                  selectedItemId={effectiveSelectedItemId}
                  selectedItemIds={selectedItemIds}
                  onSelect={handleSelectItem}
                  onDoubleClick={handleDoubleClickItem}
                  onToggleSelectItem={handleToggleSelectItem}
                />
              )}
            </div>
          </div>

          <footer className="flex h-[40px] shrink-0 items-center justify-between border-t border-border bg-card px-4 text-xs text-muted-foreground shadow-inner z-10">
            <div className="flex items-center gap-4">
              <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-bold text-card-foreground">
                ทั้งหมด {total} รายการ
              </span>
              <span className="text-muted-foreground font-semibold hidden md:inline">
                มูลค่าตามราคาที่บันทึกในหน้านี้: <span className="text-primary font-black">฿{folderValuation.toLocaleString()}</span>
              </span>
              {selectedItemIds.length > 0 && (
                <span className="text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 font-bold text-xs">
                  เลือกอยู่ {selectedItemIds.length} รายการ
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <PaginationLink href={buildPageHref(Math.max(1, page - 1))} disabled={page <= 1}>
                ก่อนหน้า
              </PaginationLink>
              <PaginationLink href={buildPageHref(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
                ถัดไป
              </PaginationLink>
              <div className="hidden items-center gap-1.5 font-semibold text-primary sm:flex">
                <span className="material-symbols-outlined text-[15px]">sync</span>
                <span>Synced</span>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Slide-Over Detail Drawer (Inspector Sheet) */}
      <Inspector
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

      {selectedItemIds.length > 0 && (
        <div className="fixed bottom-14 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur-md px-5 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 text-card-foreground">
          <span className="text-xs font-bold text-card-foreground">
            เลือกอยู่ <span className="text-primary font-black">{selectedItemIds.length}</span> รายการ
          </span>

          <div className="h-4 w-px bg-border" />

          {/* Bulk Update Status */}
          {userCanWrite && (
            <select
              aria-label="เปลี่ยนสถานะรายการที่เลือก"
              onChange={async (e) => {
                const newStatus = e.target.value
                if (!newStatus) return

                const prevItems = localItems
                // Optimistically update status
                setLocalItems(prev => prev.map(item =>
                  selectedItemIds.includes(item.id) ? { ...item, status: newStatus as ItemStatus } : item
                ))

                const res = await bulkUpdateItems(selectedItemIds, { status: newStatus })
                if (res.success) {
                  triggerToast(res.message || 'อัปเดตเรียบร้อย')
                  setSelectedItemIds([])
                  router.refresh()
                } else {
                  setLocalItems(prevItems)
                  setBlockingError(res.message || 'เกิดข้อผิดพลาดในการอัปเดตสถานะ')
                }
                e.target.value = ''
              }}
              className="h-8 rounded-lg border border-input bg-card px-2.5 text-xs font-semibold text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="">เปลี่ยนสถานะ...</option>
              {Object.entries(ITEM_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          )}

          {/* Bulk Update Location */}
          {userCanWrite && (
            <select
              aria-label="เปลี่ยนสถานที่รายการที่เลือก"
              onChange={async (e) => {
                const newLocId = e.target.value
                if (!newLocId) return

                const targetLoc = locations.find(l => l.id === newLocId) || null
                const prevItems = localItems

                // Optimistically update location object
                setLocalItems(prev => prev.map(item =>
                  selectedItemIds.includes(item.id) ? { ...item, location: targetLoc } : item
                ))

                const res = await bulkUpdateItems(selectedItemIds, { location_id: newLocId })
                if (res.success) {
                  triggerToast(res.message || 'อัปเดตเรียบร้อย')
                  setSelectedItemIds([])
                  router.refresh()
                } else {
                  setLocalItems(prevItems)
                  setBlockingError(res.message || 'เกิดข้อผิดพลาดในการย้ายสถานที่')
                }
                e.target.value = ''
              }}
              className="h-8 rounded-lg border border-input bg-card px-2.5 text-xs font-semibold text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-[150px]"
            >
              <option value="">ย้ายสถานที่...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          )}

          {/* Bulk Print Asset Tag */}
          <Button
            onClick={() => setIsBatchPrintOpen(true)}
            variant="outline"
            className="h-8 rounded-lg px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-card hover:bg-accent text-card-foreground border-input"
          >
            <Tag className="h-3.5 w-3.5" />
            <span>พิมพ์ลาเบล ({selectedItemIds.length})</span>
          </Button>

          {/* Bulk Delete - Admin Only */}
          {userCanDelete && (
            <Button
              onClick={async () => {
                if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสิ่งของที่เลือกทั้งหมด ${selectedItemIds.length} รายการ?`)) return

                const prevItems = localItems
                // Optimistically remove items from view
                setLocalItems(prev => prev.filter(item => !selectedItemIds.includes(item.id)))

                const res = await bulkHardDeleteItems(selectedItemIds)
                if (res.success) {
                  triggerToast(res.message || 'ลบเรียบร้อย')
                  setSelectedItemIds([])
                  router.refresh()
                } else {
                  setLocalItems(prevItems)
                  setBlockingError(res.message || 'เกิดข้อผิดพลาดในการลบพัสดุ')
                }
              }}
              variant="outline"
              className="h-8 rounded-lg px-3 text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30 cursor-pointer"
            >
              ลบทั้งหมด
            </Button>
          )}

          <div className="h-4 w-px bg-border" />

          {/* Clear Selection */}
          <button
            onClick={() => setSelectedItemIds([])}
            className="text-xs text-muted-foreground hover:text-card-foreground font-bold transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
        </div>
      )}

      <AssetTagModal
        isOpen={isBatchPrintOpen || Boolean(singlePrintItem)}
        onClose={() => {
          setIsBatchPrintOpen(false)
          setSinglePrintItem(null)
        }}
        item={singlePrintItem ?? undefined}
        items={isBatchPrintOpen ? selectedItemsData : undefined}
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
        assetNumberTemplates={assetNumberTemplates}
      />
    </div>
  )
}

interface ItemsListProps {
  items: ItemListRow[]
  selectedItemId: string | null
  selectedItemIds: string[]
  onSelect: (item: ItemListRow) => void
  onDoubleClick?: (item: ItemListRow) => void
  onToggleSelectItem: (id: string) => void
  onToggleSelectAll: () => void
  params: ItemListSearchParams
  onToggleSort: (field: string) => void
}

function ItemsList({
  items,
  selectedItemId,
  selectedItemIds,
  onSelect,
  onDoubleClick,
  onToggleSelectItem,
  onToggleSelectAll,
  params,
  onToggleSort,
}: ItemsListProps) {
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

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-muted/20">
      <DataTable wrapperClassName="border-0 rounded-none bg-transparent shadow-none" className="text-card-foreground">
        <DataTableHeader className="bg-muted/50 border-b border-border">
          <tr>
            <DataTableHead isCheckbox>
              <input
                type="checkbox"
                aria-label="เลือกทุกรายการในหน้านี้"
                checked={items.length > 0 && selectedItemIds.length === items.length}
                onChange={onToggleSelectAll}
                className="rounded border-input text-primary focus:ring-ring w-4 h-4 cursor-pointer"
              />
            </DataTableHead>
            <DataTableHead className="w-12 px-2" />
            <DataTableHead className="min-w-[220px] px-2">{renderSortHeader('item_name', 'ชื่อพัสดุ')}</DataTableHead>
            <DataTableHead className="hidden sm:table-cell">{renderSortHeader('item_type', 'ประเภท')}</DataTableHead>
            <DataTableHead className="hidden md:table-cell">หมวดหมู่</DataTableHead>
            <DataTableHead>{renderSortHeader('quantity', 'จำนวน', 'center')}</DataTableHead>
            <DataTableHead>สถานที่</DataTableHead>
            <DataTableHead className="hidden xl:table-cell">ผู้รับผิดชอบ</DataTableHead>
            <DataTableHead>{renderSortHeader('status', 'สถานะ')}</DataTableHead>
          </tr>
        </DataTableHeader>
        <DataTableBody className="divide-y divide-border/40 bg-transparent">
          {items.map((item) => {
            const isSelected = selectedItemId === item.id
            const isChecked = selectedItemIds.includes(item.id)
            return (
              <DataTableRow
                key={item.id}
                onClick={() => onSelect(item)}
                onDoubleClick={() => onDoubleClick?.(item)}
                className={cn(
                  'cursor-pointer transition-colors',
                  isSelected
                    ? 'border-b border-primary/30 bg-primary/10 text-card-foreground'
                    : 'border-b border-border/60 text-card-foreground hover:bg-muted/40'
                )}
              >
                <DataTableCell isCheckbox onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`เลือก ${item.item_name}`}
                    checked={isChecked}
                    onChange={() => onToggleSelectItem(item.id)}
                    className="rounded border-input text-primary focus:ring-ring w-4 h-4 cursor-pointer"
                  />
                </DataTableCell>
                <DataTableCell className="px-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground">
                    {typeIcons[item.item_type]}
                  </div>
                </DataTableCell>
                <DataTableCell className="px-2">
                  <div className="font-extrabold text-card-foreground">{item.item_name}</div>
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {item.asset_no || item.serial_no || '- ไม่มีเลขอ้างอิง -'}
                  </div>
                </DataTableCell>
                <DataTableCell className="hidden font-semibold text-muted-foreground sm:table-cell">{ITEM_TYPE_LABELS[item.item_type]}</DataTableCell>
                <DataTableCell className="hidden text-muted-foreground md:table-cell">{item.category?.name ?? '-'}</DataTableCell>
                <DataTableCell className="text-center font-extrabold text-card-foreground">{item.quantity} {item.unit?.name ?? ''}</DataTableCell>
                <DataTableCell className="font-semibold text-muted-foreground">{item.location?.name ?? '-'}</DataTableCell>
                <DataTableCell className="hidden font-semibold text-muted-foreground xl:table-cell">{item.responsible_person ?? '-'}</DataTableCell>
                <DataTableCell><StatusBadge status={item.status} /></DataTableCell>
              </DataTableRow>
            )
          })}
          {!items.length && <EmptyRows />}
        </DataTableBody>
      </DataTable>
    </div>
  )
}

interface ItemsGridProps {
  items: ItemListRow[]
  selectedItemId: string | null
  selectedItemIds: string[]
  onSelect: (item: ItemListRow) => void
  onDoubleClick?: (item: ItemListRow) => void
  onToggleSelectItem: (id: string) => void
}

function ItemsGrid({
  items,
  selectedItemId,
  selectedItemIds,
  onSelect,
  onDoubleClick,
  onToggleSelectItem,
}: ItemsGridProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4">
      {items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((item) => {
            const isSelected = selectedItemId === item.id
            const isChecked = selectedItemIds.includes(item.id)
            return (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                onDoubleClick={() => onDoubleClick?.(item)}
                className={cn(
                  'group relative flex min-h-40 flex-col rounded-lg border p-3 text-left transition-all cursor-pointer',
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
                      isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground opacity-0 group-hover:opacity-100'
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

function EmptyRows() {
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

function Inspector({
  isOpen,
  onClose,
  item,
  userCanWrite,
  userCanDelete,
  onCopy,
  onPrint,
  onEdit,
}: {
  isOpen: boolean
  onClose: () => void
  item: ItemListRow | null
  userCanWrite: boolean
  userCanDelete: boolean
  onCopy: (value: string | null | undefined) => void
  onPrint: (item: ItemStickerData) => void
  onEdit: (item: ItemListRow) => void
}) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !item) {
    return null
  }

  const stickerData: ItemStickerData = {
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
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
        data-testid="inspector-backdrop"
      />

      {/* Drawer Panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col border-l border-border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-right duration-250"
        aria-label="รายละเอียดรายการ"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-5 py-4">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">รายละเอียดสิ่งของ</span>
            <h3 className="truncate text-base font-extrabold text-card-foreground">{item.item_name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="ปิดแถบรายละเอียด"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
          {/* Image preview */}
          <div className="relative h-52 shrink-0 overflow-hidden border-b border-border bg-muted">
            {item.image_url ? (
              <ZoomableImage
                src={item.image_url}
                alt={item.item_name}
                className="h-full w-full"
                imgClassName="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                <Package className="h-12 w-12 stroke-[1.25] text-muted-foreground/50" />
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">No Image Available</span>
              </div>
            )}

            <Link
              href={`/items/${item.id}`}
              className="absolute right-3 top-3 rounded-full bg-card/95 p-2 text-primary shadow-md transition-transform hover:scale-105 hover:bg-card"
              title="เปิดหน้ารายละเอียดเต็ม"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-col gap-4 p-5">
            {/* Title card */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-base font-extrabold leading-tight text-card-foreground">{item.item_name}</h4>
                <StatusBadge status={item.status} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-border bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                  {item.category?.name || 'หมวดหมู่ทั่วไป'}
                </span>
                <span className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                  {ITEM_TYPE_LABELS[item.item_type]}
                </span>
              </div>
            </div>

            {/* Asset No / Serial Number */}
            {item.asset_no && (
              <InspectorBox icon={<Tag className="h-3.5 w-3.5 text-primary" />} label="เลขครุภัณฑ์">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate rounded border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs font-bold text-card-foreground">
                    {item.asset_no}
                  </p>
                  <button
                    type="button"
                    onClick={() => onCopy(item.asset_no)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary cursor-pointer"
                    title="คัดลอกเลขครุภัณฑ์"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </InspectorBox>
            )}

            {item.serial_no && (
              <InspectorBox icon={<Tag className="h-3.5 w-3.5 text-primary" />} label="Serial Number">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate rounded border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs font-bold text-card-foreground">
                    {item.serial_no}
                  </p>
                  <button
                    type="button"
                    onClick={() => onCopy(item.serial_no)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary cursor-pointer"
                    title="คัดลอก Serial Number"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </InspectorBox>
            )}

            {!item.asset_no && !item.serial_no && (
              <InspectorBox icon={<Tag className="h-3.5 w-3.5 text-primary" />} label="เลขอ้างอิง">
                <p className="truncate rounded border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs text-muted-foreground">
                  - ไม่มีเลขอ้างอิง -
                </p>
              </InspectorBox>
            )}

            {/* Quantity & Unit Price */}
            <div className="grid grid-cols-2 gap-3">
              <InspectorBox icon={<Package className="h-3.5 w-3.5 text-primary" />} label="จำนวนคงเหลือ">
                <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs font-bold text-card-foreground">
                  {item.quantity} {item.unit?.name ?? ''}
                </div>
              </InspectorBox>

              <InspectorBox icon={<span className="material-symbols-outlined text-[15px] text-primary">payments</span>} label="ราคาต่อหน่วย">
                <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs font-bold text-card-foreground">
                  {item.unit_price !== null && item.unit_price !== undefined ? `฿${item.unit_price.toLocaleString()}` : '-'}
                </div>
              </InspectorBox>
            </div>

            {/* Location */}
            <InspectorBox icon={<MapPin className="h-3.5 w-3.5 text-primary" />} label="สถานที่จัดเก็บ">
              <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs font-medium text-card-foreground">
                {item.location?.name || 'ไม่ได้ระบุ'}
              </div>
            </InspectorBox>

            {/* Responsible Person */}
            <InspectorBox icon={<User className="h-3.5 w-3.5 text-primary" />} label="ผู้รับผิดชอบ">
              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-2.5 text-xs font-medium text-card-foreground">
                <div className="mr-2.5 flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">
                  {(item.responsible_person || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="font-bold text-card-foreground">{item.responsible_person || 'ยังไม่มีผู้รับผิดชอบ'}</span>
              </div>
            </InspectorBox>

            {/* Brand / Model */}
            {(item.brand || item.model) && (
              <InspectorBox icon={<Package className="h-3.5 w-3.5 text-primary" />} label="ยี่ห้อ / รุ่น">
                <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs font-medium text-card-foreground">
                  {[item.brand, item.model].filter(Boolean).join(' - ') || '-'}
                </div>
              </InspectorBox>
            )}

            {/* Note */}
            <InspectorBox icon={<StickyNote className="h-3.5 w-3.5 text-primary" />} label="หมายเหตุ">
              <p className="max-h-24 overflow-y-auto rounded-lg border border-border bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
                {item.note || '- ไม่มีหมายเหตุ -'}
              </p>
            </InspectorBox>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 border-t border-border bg-card p-4">
          <div className="flex flex-col gap-2 w-full">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onPrint(stickerData)}
                className="h-10 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Tag className="h-4 w-4" />
                <span>พิมพ์ป้ายบาร์โค้ด</span>
              </Button>
              <Link href={`/items/${item.id}`} className="w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>ดูหน้ารายละเอียดเต็ม</span>
                </Button>
              </Link>
            </div>

            {userCanWrite && (
              <Button
                type="button"
                variant="default"
                onClick={() => onEdit(item)}
                className="h-10 w-full rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
              >
                  <Edit className="h-4 w-4" />
                  <span>แก้ไขข้อมูล</span>
              </Button>
            )}

            {userCanDelete && (
              <div className="w-full">
                <DeleteItemButton id={item.id} />
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

function InspectorBox({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
      <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-primary">
        {icon}
        <span>{label}</span>
      </p>
      {children}
    </div>
  )
}

function PaginationLink({
  href,
  disabled,
  children,
}: {
  href: string
  disabled: boolean
  children: React.ReactNode
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground/60">
        {children}
      </span>
    )
  }

  return (
    <Link href={href} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-card-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary">
      {children}
    </Link>
  )
}

// Status badges are handled by the shared StatusBadge component
