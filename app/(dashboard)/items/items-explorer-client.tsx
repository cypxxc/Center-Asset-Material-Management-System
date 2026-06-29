'use client'

import React, { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  CheckCircle,
  ChevronRight,
  Copy,
  Download,
  Edit,
  ExternalLink,
  FileText,
  Folder,
  Home,
  LayoutGrid,
  List,
  MapPin,
  Package,
  Search,
  StickyNote,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ITEM_STATUS_LABELS,
  ITEM_TYPE_LABELS,
  ItemListRow,
  ItemStatus,
  ItemType,
} from '@/features/items/types'
import { DeleteItemButton } from '@/features/items/components/delete-item-button'
import { bulkUpdateItems, bulkDeleteItems, getItemsForExport } from '@/features/items/actions'
import { cn } from '@/lib/utils'
import ExcelJS from 'exceljs'

interface ItemsExplorerClientProps {
  items: ItemListRow[]
  total: number
  page: number
  totalPages: number
  params: { q?: string; type?: string; status?: string; page?: string; category_id?: string; location_id?: string }
  userCanWrite: boolean
  userCanDelete: boolean
  locations: { id: string; name: string }[]
  categories: { id: string; name: string }[]
}

type ViewMode = 'list' | 'grid'

const typeIcons: Record<ItemType, React.ReactNode> = {
  asset: <Package className="h-4 w-4 text-blue-600" />,
  material: <FileText className="h-4 w-4 text-emerald-600" />,
  general: <Folder className="h-4 w-4 text-slate-500" />,
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
}: ItemsExplorerClientProps) {
  const router = useRouter()
  const [selectedItemId, setSelectedItemId] = useState<string | null>(items[0]?.id || null)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [blockingError, setBlockingError] = useState<string | null>(null)
  const [searchVal, setSearchVal] = useState(params.q ?? '')
  const [prevQ, setPrevQ] = useState(params.q ?? '')
  const [isPending, startTransition] = useTransition()
  const [isExporting, setIsExporting] = useState(false)

  const currentQ = params.q ?? ''
  if (currentQ !== prevQ) {
    setPrevQ(currentQ)
    setSearchVal(currentQ)
  }

  const handleFilterChange = (updates: { q?: string; type?: string; status?: string; category_id?: string; location_id?: string }) => {
    const query = new URLSearchParams()
    
    const newQ = updates.q !== undefined ? updates.q : searchVal
    const newType = updates.type !== undefined ? updates.type : (params.type ?? '')
    const newStatus = updates.status !== undefined ? updates.status : (params.status ?? '')
    const newCategory = updates.category_id !== undefined ? updates.category_id : (params.category_id ?? '')
    const newLocation = updates.location_id !== undefined ? updates.location_id : (params.location_id ?? '')
    
    if (newQ) query.set('q', newQ)
    if (newType) query.set('type', newType)
    if (newStatus) query.set('status', newStatus)
    if (newCategory) query.set('category_id', newCategory)
    if (newLocation) query.set('location_id', newLocation)
    
    startTransition(() => {
      router.push(`/items?${query.toString()}`)
    })
  }

  const effectiveSelectedItemId = items.some((item) => item.id === selectedItemId)
    ? selectedItemId
    : items[0]?.id ?? null
  const selectedItem = items.find((item) => item.id === effectiveSelectedItemId) ?? null

  const triggerToast = (message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(null), 2000)
  }

  const copyReference = (value: string | null | undefined) => {
    if (!value) return
    navigator.clipboard.writeText(value)
    triggerToast(`คัดลอก "${value}" แล้ว`)
  }

  const exportToExcel = async () => {
    if (isExporting) return
    setIsExporting(true)
    triggerToast('กำลังจัดเตรียมไฟล์ Export...')
    try {
      const allItems = await getItemsForExport(params)
      if (!allItems || allItems.length === 0) {
        setBlockingError('ไม่พบข้อมูลที่จะส่งออก')
        setIsExporting(false)
        return
      }

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('ทะเบียนสิ่งของ')

      worksheet.columns = [
        { header: 'ชื่อสิ่งของ', key: 'item_name', width: 25 },
        { header: 'ประเภท', key: 'item_type', width: 15 },
        { header: 'หมวดหมู่', key: 'category_name', width: 15 },
        { header: 'จำนวน', key: 'quantity', width: 10 },
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
    } catch (err: any) {
      console.error(err)
      setBlockingError('เกิดข้อผิดพลาดขณะส่งออกข้อมูล: ' + (err.message || err))
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

  const getItemValue = (name: string, categoryName?: string): number => {
    const title = name.toLowerCase()
    const cat = (categoryName || '').toLowerCase()
    if (title.includes('dell') || title.includes('latitude') || title.includes('macbook')) return 35000
    if (title.includes('chair') || title.includes('ergonomic')) return 5500
    if (title.includes('projector') || title.includes('epson')) return 18900
    if (title.includes('printer') || title.includes('laserjet')) return 8900
    if (title.includes('ipad') || title.includes('tablet')) return 16900
    if (cat.includes('it') || cat.includes('tech') || cat.includes('คอม')) return 12000
    if (cat.includes('เฟอร์') || cat.includes('โต๊ะ') || cat.includes('เก้าอี้')) return 3000
    if (cat.includes('av')) return 9000
    return 1500
  }

  const folderValuation = useMemo(() => {
    return items.reduce((sum, item) => sum + (getItemValue(item.item_name, item.category?.name) * item.quantity), 0)
  }, [items])

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleToggleSelectAll = () => {
    if (selectedItemIds.length === items.length) {
      setSelectedItemIds([])
    } else {
      setSelectedItemIds(items.map((item) => item.id))
    }
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#f1f5f9] text-slate-900 font-sans">
      {toastMessage && (
        <div className="fixed left-1/2 top-16 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-xs font-semibold text-white shadow-xl">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Main Content Area */}
        <main className="flex min-w-0 flex-1 flex-col bg-white">
          {/* Dynamic Integrated Header Area */}
          <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-5 md:px-8">
            {/* Row 1: Breadcrumb (Left) & View Mode Toggle (Right) */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col min-w-0">
                {/* Monospace Breadcrumb Path */}
                <div className="flex items-center text-[10px] md:text-[11px] font-bold text-slate-400 font-mono tracking-wider uppercase mb-1.5 whitespace-nowrap overflow-x-auto">
                  <Home className="w-3.5 h-3.5 mr-1.5 text-blue-600 flex-shrink-0" />
                  <span>root</span>
                  <ChevronRight className="mx-1 h-3 w-3 text-slate-300 flex-shrink-0" />
                  <span className="text-slate-500">items</span>
                  {params.type && (
                    <>
                      <ChevronRight className="mx-1 h-3 w-3 text-slate-300 flex-shrink-0" />
                      <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                        {ITEM_TYPE_LABELS[params.type as ItemType]?.toLowerCase() ?? params.type}
                      </span>
                    </>
                  )}
                  {params.category_id && (
                    <>
                      <ChevronRight className="mx-1 h-3 w-3 text-slate-300 flex-shrink-0" />
                      <span className="text-slate-600 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        category:{categories.find(c => c.id === params.category_id)?.name || params.category_id}
                      </span>
                    </>
                  )}
                  {params.status && (
                    <>
                      <ChevronRight className="mx-1 h-3 w-3 text-slate-300 flex-shrink-0" />
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                        {ITEM_STATUS_LABELS[params.status as ItemStatus]?.toLowerCase() ?? params.status}
                      </span>
                    </>
                  )}
                  {params.q && (
                    <>
                      <ChevronRight className="mx-1 h-3 w-3 text-slate-300 flex-shrink-0" />
                      <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                        search:{params.q.toLowerCase()}
                      </span>
                    </>
                  )}
                </div>

                {/* Dynamic Main Title */}
                <h2 className="text-lg md:text-xl font-black tracking-tight text-slate-900 leading-tight">
                  {params.type === 'material'
                    ? 'รายการทะเบียนวัสดุ'
                    : params.type === 'asset'
                    ? 'รายการทะเบียนครุภัณฑ์'
                    : params.type === 'general'
                    ? 'รายการทะเบียนอุปกรณ์ทั่วไป'
                    : 'รายการทะเบียนสิ่งของ'}
                </h2>
              </div>

              {/* View Mode Toggle */}
              <div className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'rounded-md p-1.5 transition-all cursor-pointer',
                    viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  )}
                  title="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'rounded-md p-1.5 transition-all cursor-pointer',
                    viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  )}
                  title="Grid view"
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
                  <div className="relative w-full sm:w-80 flex-shrink-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      name="q"
                      value={searchVal}
                      onChange={(e) => setSearchVal(e.target.value)}
                      onBlur={() => handleFilterChange({ q: searchVal })}
                      placeholder="ค้นหาชื่อ, เลขครุภัณฑ์, Serial..."
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-800 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Category Filter */}
                    <select
                      name="category_id"
                      value={params.category_id ?? ''}
                      onChange={(e) => handleFilterChange({ category_id: e.target.value })}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none cursor-pointer shadow-sm"
                    >
                      <option value="">กรองตามหมวดหมู่</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>

                    {/* Status Filter */}
                    <select
                      name="status"
                      value={params.status ?? ''}
                      onChange={(e) => handleFilterChange({ status: e.target.value })}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none cursor-pointer shadow-sm"
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
                  <span>Export Excel</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="relative flex-1 min-h-0 flex flex-col">
            {isPending && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/40 backdrop-blur-[1px] transition-all duration-200">
                <div className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white shadow-xl border border-slate-100 animate-in zoom-in-95 duration-200">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                  <span className="text-[10px] font-bold text-slate-500">กำลังดึงข้อมูล...</span>
                </div>
              </div>
            )}
            <div className={cn("flex-1 min-h-0 flex flex-col transition-opacity duration-200", isPending && "opacity-50 pointer-events-none")}>
              {viewMode === 'list' ? (
                <ItemsList
                  items={items}
                  selectedItemId={effectiveSelectedItemId}
                  selectedItemIds={selectedItemIds}
                  onSelect={(item) => {
                    setSelectedItemId(item.id)
                    if (window.innerWidth < 1024) router.push(`/items/${item.id}`)
                  }}
                  onToggleSelectItem={handleToggleSelectItem}
                  onToggleSelectAll={handleToggleSelectAll}
                />
              ) : (
                <ItemsGrid
                  items={items}
                  selectedItemId={effectiveSelectedItemId}
                  selectedItemIds={selectedItemIds}
                  onSelect={(item) => {
                    setSelectedItemId(item.id)
                    if (window.innerWidth < 1024) router.push(`/items/${item.id}`)
                  }}
                  onToggleSelectItem={handleToggleSelectItem}
                />
              )}
            </div>
          </div>

          <footer className="flex h-[40px] shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 text-xs text-slate-500 shadow-inner z-10">
            <div className="flex items-center gap-4">
              <span className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                ทั้งหมด {total} รายการ
              </span>
              <span className="text-slate-500 font-semibold hidden md:inline">
                มูลค่าประเมินในหน้านี้: <span className="text-blue-600 font-black">฿{folderValuation.toLocaleString()}</span>
              </span>
              {selectedItemIds.length > 0 && (
                <span className="text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 font-bold text-[10px]">
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
              <div className="hidden items-center gap-1.5 font-semibold text-blue-600 sm:flex">
                <span className="material-symbols-outlined text-[15px]">sync</span>
                <span>Synced</span>
              </div>
            </div>
          </footer>
        </main>

        <Inspector
          item={selectedItem}
          userCanWrite={userCanWrite}
          userCanDelete={userCanDelete}
          onCopy={copyReference}
        />
      </div>

      {selectedItemIds.length > 0 && (
        <div className="fixed bottom-14 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-blue-200 bg-white/90 backdrop-blur-md px-5 py-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-xs font-bold text-slate-700">
            เลือกอยู่ <span className="text-blue-600 font-black">{selectedItemIds.length}</span> รายการ
          </span>

          <div className="h-4 w-px bg-slate-200" />

          {/* Bulk Update Status */}
          {userCanWrite && (
            <select
              onChange={async (e) => {
                if (!e.target.value) return
                const res = await bulkUpdateItems(selectedItemIds, { status: e.target.value })
                if (res.ok) {
                  triggerToast(res.message || 'อัปเดตเรียบร้อย')
                  setSelectedItemIds([])
                  router.refresh()
                } else {
                  setBlockingError(res.message || 'เกิดข้อผิดพลาดในการอัปเดตสถานะ')
                }
                e.target.value = ''
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 focus:outline-none cursor-pointer"
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
              onChange={async (e) => {
                if (!e.target.value) return
                const res = await bulkUpdateItems(selectedItemIds, { location_id: e.target.value })
                if (res.ok) {
                  triggerToast(res.message || 'อัปเดตเรียบร้อย')
                  setSelectedItemIds([])
                  router.refresh()
                } else {
                  setBlockingError(res.message || 'เกิดข้อผิดพลาดในการย้ายสถานที่')
                }
                e.target.value = ''
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[150px]"
            >
              <option value="">ย้ายสถานที่...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          )}

          {/* Bulk Delete - Admin Only */}
          {userCanDelete && (
            <Button
              onClick={async () => {
                if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสิ่งของที่เลือกทั้งหมด ${selectedItemIds.length} รายการ?`)) return
                const res = await bulkDeleteItems(selectedItemIds)
                if (res.ok) {
                  triggerToast(res.message || 'ลบเรียบร้อย')
                  setSelectedItemIds([])
                  router.refresh()
                } else {
                  setBlockingError(res.message || 'เกิดข้อผิดพลาดในการลบพัสดุ')
                }
              }}
              variant="outline"
              className="h-8 rounded-lg px-3 text-[11px] font-bold text-red-600 hover:bg-red-50 border-red-200 cursor-pointer"
            >
              ลบทั้งหมด
            </Button>
          )}

          <div className="h-4 w-px bg-slate-200" />

          {/* Clear Selection */}
          <button
            onClick={() => setSelectedItemIds([])}
            className="text-xs text-slate-400 hover:text-slate-600 font-bold transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
        </div>
      )}

      {/* Blocking Error Modal */}
      {blockingError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <span className="material-symbols-outlined text-[28px]">error</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-950">การดำเนินงานล้มเหลว</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{blockingError}</p>
              </div>
              <button
                type="button"
                onClick={() => setBlockingError(null)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center cursor-pointer"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface ItemsListProps {
  items: ItemListRow[]
  selectedItemId: string | null
  selectedItemIds: string[]
  onSelect: (item: ItemListRow) => void
  onToggleSelectItem: (id: string) => void
  onToggleSelectAll: () => void
}

function ItemsList({
  items,
  selectedItemId,
  selectedItemIds,
  onSelect,
  onToggleSelectItem,
  onToggleSelectAll,
}: ItemsListProps) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-slate-50/20">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <tr>
            <th className="w-8 px-3 py-2 text-center">
              <input
                type="checkbox"
                checked={items.length > 0 && selectedItemIds.length === items.length}
                onChange={onToggleSelectAll}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
              />
            </th>
            <th className="w-12 px-2 py-2" />
            <th className="min-w-[220px] px-2 py-2">Name</th>
            <th className="hidden px-4 py-2 sm:table-cell">Type</th>
            <th className="hidden px-4 py-2 md:table-cell">Category</th>
            <th className="px-4 py-2 text-center">Qty</th>
            <th className="px-4 py-2">Location</th>
            <th className="hidden px-4 py-2 xl:table-cell">Custodian</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const isSelected = selectedItemId === item.id
            const isChecked = selectedItemIds.includes(item.id)
            return (
              <tr
                key={item.id}
                onClick={() => onSelect(item)}
                className={cn(
                  'cursor-pointer transition-all duration-150',
                  isSelected
                    ? 'border-l-2 border-l-blue-600 bg-blue-50/80 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleSelectItem(item.id)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                  />
                </td>
                <td className="px-2 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100">
                    {typeIcons[item.item_type]}
                  </div>
                </td>
                <td className="px-2 py-3">
                  <div className="font-extrabold text-slate-800">{item.item_name}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                    {item.asset_no || item.serial_no || '- ไม่มีเลขอ้างอิง -'}
                  </div>
                </td>
                <td className="hidden px-4 py-3 font-semibold sm:table-cell">{ITEM_TYPE_LABELS[item.item_type]}</td>
                <td className="hidden px-4 py-3 md:table-cell">{item.category?.name ?? '-'}</td>
                <td className="px-4 py-3 text-center font-extrabold text-slate-800">{item.quantity} {item.unit?.name ?? ''}</td>
                <td className="px-4 py-3 font-semibold text-slate-600">{item.location?.name ?? '-'}</td>
                <td className="hidden px-4 py-3 font-semibold xl:table-cell">{item.responsible_person ?? '-'}</td>
                <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
              </tr>
            )
          })}
          {!items.length && <EmptyRows />}
        </tbody>
      </table>
    </div>
  )
}

interface ItemsGridProps {
  items: ItemListRow[]
  selectedItemId: string | null
  selectedItemIds: string[]
  onSelect: (item: ItemListRow) => void
  onToggleSelectItem: (id: string) => void
}

function ItemsGrid({
  items,
  selectedItemId,
  selectedItemIds,
  onSelect,
  onToggleSelectItem,
}: ItemsGridProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/20 p-4">
      {items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((item) => {
            const isSelected = selectedItemId === item.id
            const isChecked = selectedItemIds.includes(item.id)
            return (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className={cn(
                  'group relative flex min-h-40 flex-col rounded-lg border bg-white p-3 text-left transition-all cursor-pointer',
                  isSelected ? 'border-blue-300 bg-blue-50/80 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                )}
              >
                {/* Checkbox Overlay */}
                <div className="absolute top-3 right-3 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onToggleSelectItem(item.id)}
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer',
                      isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white opacity-0 group-hover:opacity-100'
                    )}
                  >
                    {isChecked && <Check className="w-3 h-3 stroke-[3px]" />}
                  </button>
                </div>

                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 shadow-inner transition-transform group-hover:scale-105">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image_url} alt={item.item_name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    typeIcons[item.item_type]
                  )}
                </div>
                <p className="line-clamp-2 text-xs font-extrabold leading-snug text-slate-800 pr-4">{item.item_name}</p>
                <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{item.asset_no || item.serial_no || '-'}</p>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                    {ITEM_TYPE_LABELS[item.item_type]}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">{item.quantity} {item.unit?.name ?? ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
          ไม่พบข้อมูลสิ่งของในทะเบียน
        </div>
      )}
    </div>
  )
}

function EmptyRows() {
  return (
    <tr>
      <td colSpan={9} className="px-5 py-16 text-center text-slate-400">
        <Package className="mx-auto mb-2 h-8 w-8 text-slate-300" />
        <p className="text-sm font-bold text-slate-500">ไม่พบข้อมูลสิ่งของ</p>
        <p className="mt-1 text-xs">ลองล้างตัวกรองหรือขึ้นทะเบียนรายการใหม่</p>
      </td>
    </tr>
  )
}

function Inspector({
  item,
  userCanWrite,
  userCanDelete,
  onCopy,
}: {
  item: ItemListRow | null
  userCanWrite: boolean
  userCanDelete: boolean
  onCopy: (value: string | null | undefined) => void
}) {
  if (!item) {
    return (
      <aside className="hidden w-[320px] shrink-0 flex-col items-center justify-center border-l border-slate-200 bg-white p-6 text-center text-slate-400 lg:flex">
        <Folder className="h-10 w-10 text-slate-300" />
        <p className="mt-2 text-xs font-bold text-slate-700">เลือกสิ่งของเพื่อดูรายละเอียด</p>
        <p className="mt-1 max-w-[220px] text-[10px] leading-relaxed text-slate-400">
          คลิกรายการในตารางหรือ grid เพื่อเปิด inspector ด้านขวา
        </p>
      </aside>
    )
  }

  const reference = item.serial_no || item.asset_no

  return (
    <aside className="hidden h-full w-[320px] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-sm lg:flex xl:w-[360px]">
      <div className="relative h-48 shrink-0 overflow-hidden border-b border-slate-100 bg-slate-100">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt={item.item_name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-300">
            <Package className="h-12 w-12 stroke-[1.25]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No Image Available</span>
          </div>
        )}

        <Link
          href={`/items/${item.id}`}
          className="absolute right-3 top-3 rounded-full bg-white/95 p-2 text-blue-600 shadow-md transition-transform hover:scale-105 hover:bg-white animate-fade-in"
          title="เปิดหน้ารายละเอียดเต็ม"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-4 bg-gradient-to-b from-white to-slate-50/40 p-4">
        <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-extrabold leading-tight text-slate-800">{item.item_name}</h3>
            {getStatusBadge(item.status)}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded border border-slate-200/60 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {item.category?.name || 'หมวดหมู่ทั่วไป'}
            </span>
            <span className="rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              {ITEM_TYPE_LABELS[item.item_type]}
            </span>
          </div>
        </div>

        <InspectorBox icon={<span className="material-symbols-outlined text-[15px] text-blue-500">tag</span>} label="Serial Number / เลขครุภัณฑ์">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate rounded border border-slate-100 bg-slate-50 px-2 py-1 font-mono text-xs font-bold text-slate-800">
              {reference || '-'}
            </p>
            <button
              type="button"
              onClick={() => onCopy(reference)}
              disabled={!reference}
              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 disabled:opacity-40 cursor-pointer"
              title="คัดลอกเลขอ้างอิง"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </InspectorBox>

        <InspectorBox icon={<MapPin className="h-3.5 w-3.5 text-orange-500" />} label="สถานที่จัดเก็บ">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs font-semibold text-slate-700">
            {item.location?.name || 'ไม่ได้ระบุ'}
          </div>
        </InspectorBox>

        <InspectorBox icon={<User className="h-3.5 w-3.5 text-emerald-500" />} label="ผู้รับผิดชอบ">
          <div className="flex items-center rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs font-semibold text-slate-700">
            <div className="mr-2.5 flex h-6 w-6 items-center justify-center rounded-full border border-blue-300 bg-blue-100 text-[10px] font-bold text-blue-700">
              {(item.responsible_person || 'U').charAt(0).toUpperCase()}
            </div>
            <span className="font-bold">{item.responsible_person || 'ยังไม่มีผู้รับผิดชอบ'}</span>
          </div>
        </InspectorBox>

        <InspectorBox icon={<StickyNote className="h-3.5 w-3.5 text-amber-500" />} label="หมายเหตุ">
          <p className="max-h-24 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-500">
            {item.note || '- ไม่มีหมายเหตุ -'}
          </p>
        </InspectorBox>

        <div className="mt-auto border-t border-slate-100 pt-4">
          {(userCanWrite || userCanDelete) && (
            <div className="flex gap-2">
              {userCanWrite && (
                <Link href={`/items/${item.id}/edit`} className="flex-1">
                  <Button variant="outline" className="h-10 w-full rounded-lg text-xs font-bold cursor-pointer">
                    <Edit className="h-4 w-4" />
                    แก้ไขข้อมูล
                  </Button>
                </Link>
              )}
              {userCanDelete && (
                <div className="flex-1">
                  <DeleteItemButton id={item.id} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
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
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-600">
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
      <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-300">
        {children}
      </span>
    )
  }

  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
      {children}
    </Link>
  )
}

function getStatusBadge(status: ItemStatus) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold', getStatusBadgeClass(status))}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {ITEM_STATUS_LABELS[status]}
    </span>
  )
}

function getStatusBadgeClass(status: ItemStatus) {
  switch (status) {
    case 'active':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'spare':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'damaged':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    case 'waiting_repair':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'disposed':
      return 'border-red-200 bg-red-50 text-red-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}
