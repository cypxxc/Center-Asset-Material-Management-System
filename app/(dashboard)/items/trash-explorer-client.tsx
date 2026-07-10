'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package,
  FileText,
  MapPin,
  RotateCcw,
  Trash2,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import {
  ITEM_TYPE_LABELS,
  ItemType,
  ItemListSearchParams,
} from '@/features/items/types'
import { DeletedItemRow } from '@/features/items/queries'
import {
  restoreItem,
  bulkRestoreItems,
  hardDeleteItem,
  bulkHardDeleteItems,
} from '@/features/items/actions'
import { formatDateTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PageContainer } from '@/components/ui/page-container'
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

interface TrashExplorerClientProps {
  items: DeletedItemRow[]
  total: number
  page: number
  totalPages: number
  params: ItemListSearchParams
}

const typeIcons: Record<ItemType, React.ReactNode> = {
  asset: <Package className="h-4 w-4 text-blue-600" />,
  material: <FileText className="h-4 w-4 text-emerald-600" />,
}

// Confirmation dialog is handled via standard ConfirmDialog component

// Confirmation dialog is handled via standard ConfirmDialog component

// ============================================================
// Main Component
// ============================================================
export function TrashExplorerClient({
  items,
  total,
  page,
  totalPages,
  params,
}: TrashExplorerClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [hardDeleteTarget, setHardDeleteTarget] = useState<'single' | 'bulk' | null>(null)
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null)
  const [searchVal, setSearchVal] = useState(params.q ?? '')
  const [prevQ, setPrevQ] = useState(params.q ?? '')
  const [isPending, startTransition] = useTransition()

  const currentQ = params.q ?? ''
  if (currentQ !== prevQ) {
    setPrevQ(currentQ)
    setSearchVal(currentQ)
  }

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    toast(msg, type)
  }

  const handleFilterChange = (updates: {
    q?: string
    type?: string
    page?: string
    sort_by?: string
    sort_dir?: string
  }) => {
    const query = new URLSearchParams()
    query.set('deleted', 'true')
    
    const newQ = updates.q !== undefined ? updates.q : searchVal
    const newType = updates.type !== undefined ? updates.type : (params.type ?? '')
    const newSortBy = updates.sort_by !== undefined ? updates.sort_by : (params.sort_by ?? '')
    const newSortDir = updates.sort_dir !== undefined ? updates.sort_dir : (params.sort_dir ?? '')
    
    if (newQ) query.set('q', newQ)
    if (newType) query.set('type', newType)
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
    const currentField = params.sort_by || 'deleted_at'
    const currentDir = params.sort_dir || 'desc'
    
    let nextDir: 'asc' | 'desc' = 'asc'
    if (currentField === field) {
      nextDir = currentDir === 'asc' ? 'desc' : 'asc'
    } else {
      nextDir = field === 'item_name' || field === 'item_type' ? 'asc' : 'desc'
    }
    
    handleFilterChange({ sort_by: field, sort_dir: nextDir })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    handleFilterChange({ q: searchVal.trim() })
  }

  const renderSortHeader = (field: string, label: string) => {
    const currentField = params.sort_by || 'deleted_at'
    const currentDir = params.sort_dir || 'desc'
    const isSorted = currentField === field

    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className="flex items-center gap-1 hover:text-slate-700 transition-colors font-semibold text-slate-600 cursor-pointer select-none"
      >
        <span>{label}</span>
        {isSorted ? (
          currentDir === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 opacity-60 shrink-0" />
        )}
      </button>
    )
  }

  const buildPageHref = (p: number) => {
    const query = new URLSearchParams()
    query.set('deleted', 'true')
    if (params.q) query.set('q', params.q)
    if (params.type) query.set('type', params.type)
    if (params.sort_by) query.set('sort_by', params.sort_by)
    if (params.sort_dir) query.set('sort_dir', params.sort_dir)
    query.set('page', String(p))
    return `/items?${query.toString()}`
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(items.map((i) => i.id))
    }
  }

  // ---- Restore ----
  const handleRestore = (id: string) => {
    startTransition(async () => {
      const res = await restoreItem(id)
      if (res?.success) triggerToast(res.message ?? 'กู้คืนเรียบร้อย', 'success')
      else triggerToast(res?.message ?? 'เกิดข้อผิดพลาด', 'error')
      setSelectedIds([])
    })
  }

  const handleBulkRestore = () => {
    if (!selectedIds.length) return
    startTransition(async () => {
      const res = await bulkRestoreItems(selectedIds)
      if (res?.success) triggerToast(res.message ?? 'กู้คืนเรียบร้อย', 'success')
      else triggerToast(res?.message ?? 'เกิดข้อผิดพลาด', 'error')
      setSelectedIds([])
    })
  }

  // ---- Hard Delete ----
  const openHardDeleteSingle = (id: string) => {
    setHardDeleteId(id)
    setHardDeleteTarget('single')
  }

  const openHardDeleteBulk = () => {
    if (!selectedIds.length) return
    setHardDeleteTarget('bulk')
  }

  const cancelHardDelete = () => {
    setHardDeleteTarget(null)
    setHardDeleteId(null)
  }

  const confirmHardDelete = () => {
    if (hardDeleteTarget === 'single' && hardDeleteId) {
      const targetId = hardDeleteId
      startTransition(async () => {
        const res = await hardDeleteItem(targetId)
        if (res?.success) triggerToast(res.message ?? 'ลบถาวรเรียบร้อย', 'success')
        else triggerToast(res?.message ?? 'เกิดข้อผิดพลาด', 'error')
        setHardDeleteTarget(null)
        setHardDeleteId(null)
        setSelectedIds([])
      })
    } else if (hardDeleteTarget === 'bulk') {
      const targetIds = [...selectedIds]
      startTransition(async () => {
        const res = await bulkHardDeleteItems(targetIds)
        if (res?.success) triggerToast(res.message ?? 'ลบถาวรเรียบร้อย', 'success')
        else triggerToast(res?.message ?? 'เกิดข้อผิดพลาด', 'error')
        setHardDeleteTarget(null)
        setSelectedIds([])
      })
    }
  }

  const hardDeleteCount =
    hardDeleteTarget === 'bulk'
      ? selectedIds.length
      : hardDeleteTarget === 'single'
      ? 1
      : 0

  return (
    <PageContainer maxWidth="full" className="flex flex-col h-full min-h-0 bg-slate-50/50 p-6 md:p-8">

      {/* Hard Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!hardDeleteTarget}
        title="ยืนยันการลบถาวร"
        description={`คุณกำลังจะลบถาวร ${hardDeleteCount} รายการ การกระทำนี้ไม่สามารถกู้คืนได้ และข้อมูลจะหายไปจากระบบทั้งหมด`}
        confirmText="ลบถาวร ยืนยัน"
        cancelText="ยกเลิก"
        onConfirm={confirmHardDelete}
        onCancel={cancelHardDelete}
        isPending={isPending}
        variant="destructive"
      />

      {/* Header Bar */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Trash2 className="h-4 w-4 text-red-500 flex-shrink-0" />
          <h1 className="text-sm font-bold text-slate-800">ถังขยะ</h1>
          <span className="text-[11px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
            {total} รายการ
          </span>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-[200px]">
          <SearchInput
            value={searchVal}
            onChange={(val) => {
              setSearchVal(val)
              handleFilterChange({ q: val.trim() })
            }}
            onClear={() => handleFilterChange({ q: '' })}
            placeholder="ค้นหารายการที่ถูกลบ..."
            className="max-w-xs"
          />
        </form>

        {/* Back to items */}
        <Link
          href="/items"
          className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 whitespace-nowrap"
        >
          ← กลับหน้าหลัก
        </Link>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="flex-shrink-0 bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-blue-700">
            เลือก {selectedIds.length} รายการ
          </span>
          <Button
            onClick={handleBulkRestore}
            disabled={isPending}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold border-none h-7 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            กู้คืนทั้งหมด
          </Button>
          <Button
            onClick={openHardDeleteBulk}
            disabled={isPending}
            variant="destructive"
            size="sm"
            className="h-7 font-bold cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            ลบถาวร
          </Button>
          <Button
            onClick={() => setSelectedIds([])}
            variant="link"
            size="sm"
            className="h-7 text-blue-600 hover:text-blue-800 p-0 cursor-pointer"
          >
            ยกเลิกการเลือก
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {items.length === 0 ? (
          <EmptyState
            icon={<Trash2 className="h-10 w-10 opacity-30 text-slate-400" />}
            title="ถังขยะว่างเปล่า"
            description="รายการที่ถูกลบจะปรากฏที่นี่"
          />
        ) : (
          <DataTable>
            <DataTableHeader>
              <tr>
                <DataTableHead isCheckbox>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === items.length && items.length > 0}
                    onChange={toggleAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </DataTableHead>
                <DataTableHead>{renderSortHeader('item_name', 'ชื่อสิ่งของ')}</DataTableHead>
                <DataTableHead className="hidden sm:table-cell">{renderSortHeader('item_type', 'ประเภท')}</DataTableHead>
                <DataTableHead className="hidden md:table-cell font-semibold text-slate-600">สถานที่</DataTableHead>
                <DataTableHead className="hidden md:table-cell font-semibold text-slate-600">ผู้รับผิดชอบ</DataTableHead>
                <DataTableHead>{renderSortHeader('deleted_at', 'วันที่ลบ')}</DataTableHead>
                <DataTableHead isActions className="font-semibold text-slate-600">การจัดการ</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {items.map((item) => (
                <DataTableRow
                  key={item.id}
                  className={cn(
                    selectedIds.includes(item.id) && 'bg-blue-50/50 hover:bg-blue-50'
                  )}
                >
                  <DataTableCell isCheckbox>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex items-center gap-2 min-w-0">
                      {typeIcons[item.item_type]}
                      <span className="font-medium text-slate-800 truncate max-w-[200px]">
                        {item.item_name}
                      </span>
                    </div>
                    {(item.asset_no || item.serial_no) && (
                      <div className="text-[10px] text-slate-400 mt-0.5 pl-6">
                        {item.asset_no && <span>ครุ: {item.asset_no}</span>}
                        {item.asset_no && item.serial_no && <span className="mx-1">·</span>}
                        {item.serial_no && <span>S/N: {item.serial_no}</span>}
                      </div>
                    )}
                  </DataTableCell>
                  <DataTableCell className="hidden sm:table-cell text-slate-600">
                    {ITEM_TYPE_LABELS[item.item_type]}
                  </DataTableCell>
                  <DataTableCell className="hidden md:table-cell text-slate-600">
                    {item.location ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {item.location.name}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </DataTableCell>
                  <DataTableCell className="hidden md:table-cell text-slate-600">
                    {item.responsible_person ? (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" />
                        {item.responsible_person}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </DataTableCell>
                  <DataTableCell className="text-slate-500" suppressHydrationWarning>
                    {formatDateTime(item.deleted_at)}
                  </DataTableCell>
                  <DataTableCell isActions>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(item.id)}
                        disabled={isPending}
                        className="text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        กู้คืน
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => openHardDeleteSingle(item.id)}
                        disabled={isPending}
                        className="cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        ลบถาวร
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </div>

      {/* Footer / Pagination */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>
          แสดง {items.length} จาก {total} รายการที่ถูกลบ
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link
                href={buildPageHref(page - 1)}
                className="px-2 py-1 rounded hover:bg-slate-100"
              >
                ‹
              </Link>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={buildPageHref(p)}
                className={cn(
                  'px-2 py-1 rounded',
                  p === page
                    ? 'bg-slate-700 text-white font-bold'
                    : 'hover:bg-slate-100'
                )}
              >
                {p}
              </Link>
            ))}
            {page < totalPages && (
              <Link
                href={buildPageHref(page + 1)}
                className="px-2 py-1 rounded hover:bg-slate-100"
              >
                ›
              </Link>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  )
}
