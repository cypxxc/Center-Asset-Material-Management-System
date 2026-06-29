'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Package,
  FileText,
  Folder,
  MapPin,
  RotateCcw,
  Search,
  Trash2,
  User,
} from 'lucide-react'
import {
  ITEM_TYPE_LABELS,
  ItemType,
} from '@/features/items/types'
import { DeletedItemRow } from '@/features/items/queries'
import {
  restoreItem,
  bulkRestoreItems,
  hardDeleteItem,
  bulkHardDeleteItems,
} from '@/features/items/actions'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface TrashExplorerClientProps {
  items: DeletedItemRow[]
  total: number
  page: number
  totalPages: number
  params: { q?: string; type?: string; page?: string }
}

const typeIcons: Record<ItemType, React.ReactNode> = {
  asset: <Package className="h-4 w-4 text-blue-600" />,
  material: <FileText className="h-4 w-4 text-emerald-600" />,
  general: <Folder className="h-4 w-4 text-slate-500" />,
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============================================================
// Hard Delete Confirmation Dialog
// ============================================================
interface HardDeleteDialogProps {
  count: number
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

function HardDeleteConfirmDialog({ count, onConfirm, onCancel, isPending }: HardDeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl border border-red-200 p-6 max-w-md w-full mx-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">ยืนยันการลบถาวร</h3>
            <p className="text-sm text-slate-600 mt-1">
              คุณกำลังจะ{' '}
              <span className="font-semibold text-red-600">ลบถาวร {count} รายการ</span>{' '}
              การกระทำนี้{' '}
              <span className="font-semibold">ไม่สามารถกู้คืนได้</span>{' '}
              และข้อมูลจะหายไปจากระบบทั้งหมด
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isPending ? 'กำลังลบ...' : 'ลบถาวร ยืนยัน'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [toastMessage, setToastMessage] = useState<string | null>(null)
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

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    window.setTimeout(() => setToastMessage(null), 2500)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const query = new URLSearchParams()
    query.set('deleted', 'true')
    if (searchVal.trim()) query.set('q', searchVal.trim())
    if (params.type) query.set('type', params.type)
    startTransition(() => {
      router.push(`/items?${query.toString()}`)
    })
  }

  const buildPageHref = (p: number) => {
    const query = new URLSearchParams()
    query.set('deleted', 'true')
    if (params.q) query.set('q', params.q)
    if (params.type) query.set('type', params.type)
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
      if (res?.ok) triggerToast(res.message ?? 'กู้คืนเรียบร้อย')
      else triggerToast(res?.message ?? 'เกิดข้อผิดพลาด')
      setSelectedIds([])
    })
  }

  const handleBulkRestore = () => {
    if (!selectedIds.length) return
    startTransition(async () => {
      const res = await bulkRestoreItems(selectedIds)
      if (res?.ok) triggerToast(res.message ?? 'กู้คืนเรียบร้อย')
      else triggerToast(res?.message ?? 'เกิดข้อผิดพลาด')
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
        if (res?.ok) triggerToast(res.message ?? 'ลบถาวรเรียบร้อย')
        else triggerToast(res?.message ?? 'เกิดข้อผิดพลาด')
        setHardDeleteTarget(null)
        setHardDeleteId(null)
        setSelectedIds([])
      })
    } else if (hardDeleteTarget === 'bulk') {
      const targetIds = [...selectedIds]
      startTransition(async () => {
        const res = await bulkHardDeleteItems(targetIds)
        if (res?.ok) triggerToast(res.message ?? 'ลบถาวรเรียบร้อย')
        else triggerToast(res?.message ?? 'เกิดข้อผิดพลาด')
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
    <div className="flex flex-col h-full min-h-0 bg-[#f0f2f5]">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}

      {/* Hard Delete Confirmation Dialog */}
      {hardDeleteTarget && (
        <HardDeleteConfirmDialog
          count={hardDeleteCount}
          onConfirm={confirmHardDelete}
          onCancel={cancelHardDelete}
          isPending={isPending}
        />
      )}

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
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="ค้นหารายการที่ถูกลบ..."
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white"
            />
          </div>
          <button
            type="submit"
            className="h-8 px-3 text-xs font-medium bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            ค้นหา
          </button>
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
          <button
            onClick={handleBulkRestore}
            disabled={isPending}
            className="flex items-center gap-1.5 h-7 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            กู้คืนทั้งหมด
          </button>
          <button
            onClick={openHardDeleteBulk}
            disabled={isPending}
            className="flex items-center gap-1.5 h-7 px-3 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            ลบถาวร
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
          >
            ยกเลิกการเลือก
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 py-20">
            <Trash2 className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">ถังขยะว่างเปล่า</p>
            <p className="text-xs">รายการที่ถูกลบจะปรากฏที่นี่</p>
          </div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 bg-white border-b border-slate-200 z-10">
              <tr>
                <th className="w-8 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === items.length && items.length > 0}
                    onChange={toggleAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">ชื่อสิ่งของ</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600 hidden sm:table-cell">ประเภท</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600 hidden md:table-cell">สถานที่</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600 hidden md:table-cell">ผู้รับผิดชอบ</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600">วันที่ลบ</th>
                <th className="px-3 py-2.5 font-semibold text-slate-600 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    'hover:bg-slate-50 transition-colors',
                    selectedIds.includes(item.id) && 'bg-blue-50'
                  )}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2.5">
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
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell text-slate-600">
                    {ITEM_TYPE_LABELS[item.item_type]}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-slate-600">
                    {item.location ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {item.location.name}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-slate-600">
                    {item.responsible_person ? (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" />
                        {item.responsible_person}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                    {formatDate(item.deleted_at)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleRestore(item.id)}
                        disabled={isPending}
                        title="กู้คืนรายการ"
                        className="flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        กู้คืน
                      </button>
                      <button
                        onClick={() => openHardDeleteSingle(item.id)}
                        disabled={isPending}
                        title="ลบถาวร"
                        className="flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        ลบถาวร
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
  )
}
