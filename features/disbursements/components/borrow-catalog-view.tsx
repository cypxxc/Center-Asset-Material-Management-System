'use client'

import { useState, useMemo, useTransition } from 'react'
import {
  ShoppingCart,
  Calendar,
  Check,
  AlertCircle,
  MapPin,
  X,
  ArrowRight,
  PackageCheck,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { useToast } from '@/components/ui/toast'
import type { CentralAvailableItem } from '@/features/disbursements/types'
import { submitBorrowRequest } from '@/features/disbursements/actions'
import { cn } from '@/lib/utils'

interface BorrowCatalogViewProps {
  items: CentralAvailableItem[]
  currentUser?: {
    id: string
    full_name?: string | null
    role?: string | null
    department?: string | null
  } | null
  onSuccess?: (disbursementId: string) => void
  onSwitchToDocs?: () => void
}

export function BorrowCatalogView({
  items,
  currentUser,
  onSuccess,
  onSwitchToDocs,
}: BorrowCatalogViewProps) {
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Default due date: 7 days ahead
  const defaultDueDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  }, [])

  const [dueDate, setDueDate] = useState(defaultDueDate)
  const [purpose, setPurpose] = useState('')
  const [isPending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Categories list
  const categories = useMemo(() => {
    const cats = new Set<string>()
    items.forEach((item) => {
      if (item.category?.name) cats.add(item.category.name)
    })
    return Array.from(cats).sort()
  }, [items])

  // Filtered items
  const filteredItems = useMemo(() => {
    const query = q.trim().toLowerCase()
    return items.filter((item) => {
      const matchCategory =
        categoryFilter === 'all' || item.category?.name === categoryFilter
      if (!matchCategory) return false

      if (!query) return true

      const nameMatch = item.item_name.toLowerCase().includes(query)
      const assetMatch = item.asset_no?.toLowerCase().includes(query)
      const serialMatch = item.serial_no?.toLowerCase().includes(query)
      const brandMatch = item.brand?.toLowerCase().includes(query)
      const modelMatch = item.model?.toLowerCase().includes(query)
      const locMatch = item.location_name?.toLowerCase().includes(query)

      return Boolean(nameMatch || assetMatch || serialMatch || brandMatch || modelMatch || locMatch)
    })
  }, [items, q, categoryFilter])

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Selected items detail array
  const selectedItemsList = useMemo(() => {
    return items.filter((item) => selectedIds.has(item.id))
  }, [items, selectedIds])

  // Handle submit
  const handleSubmitBorrow = () => {
    if (selectedIds.size === 0) {
      toast('กรุณาเลือกรายการที่ต้องการยืมอย่างน้อย 1 รายการ', 'warning')
      return
    }
    if (!dueDate) {
      setSubmitError('กรุณาระบุวันที่กำหนดส่งคืน')
      return
    }
    if (!purpose.trim()) {
      setSubmitError('กรุณาระบุวัตถุประสงค์ในการยืม')
      return
    }

    setSubmitError(null)
    startTransition(async () => {
      const res = await submitBorrowRequest({
        item_ids: Array.from(selectedIds),
        due_date: dueDate,
        purpose: purpose.trim(),
      })

      if (!res.success) {
        setSubmitError(res.error || 'เกิดข้อผิดพลาดในการส่งคำขอ')
        toast(res.error || 'เกิดข้อผิดพลาดในการส่งคำขอ', 'error')
        return
      }

      toast(res.message || 'ส่งคำขอยืมเรียบร้อยแล้ว รอผู้ดูแลระบบอนุมัติ', 'success')
      setIsModalOpen(false)
      setSelectedIds(new Set())
      setPurpose('')

      if (res.data?.id && onSuccess) {
        onSuccess(res.data.id)
      } else if (onSwitchToDocs) {
        onSwitchToDocs()
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <SearchInput
            placeholder="ค้นหาชื่อ, หมายเลขครุภัณฑ์, ยี่ห้อ, รุ่น, สถานที่..."
            value={q}
            onChange={(val) => setQ(val)}
            disabled={isPending}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">หมวดหมู่:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">ทั้งหมด ({items.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {selectedIds.size > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              ล้างที่เลือก ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Grid of items */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="mb-3 rounded-full bg-slate-100 p-4 text-slate-400">
            <PackageCheck className="h-8 w-8 stroke-1" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">ไม่พบพัสดุส่วนกลางที่พร้อมให้ยืม</h3>
          <p className="mt-1 text-sm text-slate-500">
            {q ? 'ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น' : 'ขณะนี้ยังไม่มีพัสดุหรือครุภัณฑ์ส่วนกลางที่พร้อมให้ยืมในระบบ'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredItems.map((item) => {
            const isSelected = selectedIds.has(item.id)
            return (
              <div
                key={item.id}
                onClick={() => toggleSelect(item.id)}
                className={cn(
                  'group relative flex flex-col justify-between rounded-xl border bg-white p-4 shadow-sm transition-all duration-150 cursor-pointer select-none',
                  isSelected
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                )}
              >
                <div>
                  {/* Top status & tags */}
                  <div className="mb-2.5 flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      พร้อมยืม
                    </span>

                    {item.category?.name && (
                      <span className="max-w-[120px] truncate text-xs text-slate-500">
                        {item.category.name}
                      </span>
                    )}
                  </div>

                  {/* Item Image Preview or Icon */}
                  <div className="mb-3 flex h-36 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.item_name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Layers className="h-10 w-10 stroke-1" />
                        <span className="mt-1 text-[11px]">ไม่มีรูปภาพ</span>
                      </div>
                    )}
                  </div>

                  {/* Title & Specs */}
                  <h4 className="font-medium text-slate-900 group-hover:text-emerald-700 line-clamp-2 text-sm leading-snug">
                    {item.item_name}
                  </h4>

                  {/* Asset Code / Monospace pill */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {item.asset_no ? (
                      <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                        {item.asset_no}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        พัสดุคงทน (ต.)
                      </span>
                    )}
                  </div>

                  {/* Details metadata */}
                  <div className="mt-2.5 space-y-1 text-xs text-slate-500">
                    {(item.brand || item.model) && (
                      <div className="truncate">
                        <span className="text-slate-400">ยี่ห้อ/รุ่น:</span>{' '}
                        {[item.brand, item.model].filter(Boolean).join(' ')}
                      </div>
                    )}
                    {item.location_name && (
                      <div className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                        <span>{item.location_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom select button */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelect(item.id)
                    }}
                    className={cn(
                      'flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition',
                      isSelected
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    )}
                  >
                    {isSelected ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        เลือกแล้ว
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-3.5 w-3.5" />
                        เลือกยืมรายการนี้
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Sticky Bottom Cart Drawer / Summary Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 z-40 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-white/95 p-4 shadow-xl backdrop-blur-md sm:flex-row sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">
                    เลือกไว้แล้ว {selectedIds.size} รายการ
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-rose-500 hover:underline"
                  >
                    (ยกเลิกทั้งหมด)
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  พัสดุส่วนกลางพร้อมยืมสำหรับกิจกรรมหรือภารกิจ
                </p>
              </div>
            </div>

            <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
              <Button
                type="button"
                onClick={() => {
                  setSubmitError(null)
                  setIsModalOpen(true)
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 font-medium shadow-md shadow-emerald-600/20"
              >
                <span>ยื่นคำขอยืม ({selectedIds.size} รายการ)</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Borrow Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  ยื่นคำขอยืมพัสดุส่วนกลาง
                </h3>
                <p className="text-xs text-slate-500">
                  รายการคำขอจะถูกส่งไปยังผู้ดูแลระบบเพื่อทำการตรวจสอบและอนุมัติ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isPending}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="max-h-[68vh] overflow-y-auto px-6 py-4 space-y-4">
              {submitError && (
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>{submitError}</div>
                </div>
              )}

              {/* Borrower Info Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs space-y-1">
                <div className="font-medium text-slate-700">ผู้ยื่นคำขอ:</div>
                <div className="text-slate-900 font-semibold">
                  {currentUser?.full_name || 'ผู้ใช้งานระบบ'}
                </div>
                <div className="text-slate-500">
                  หน่วยงาน: {currentUser?.department || 'สำนักงานเขตสุขภาพที่ 7'}
                </div>
              </div>

              {/* Selected Items List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">
                    รายการที่เลือก ({selectedItemsList.length} รายการ)
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {selectedItemsList.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 text-xs hover:bg-slate-50"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-medium text-slate-800 truncate">
                          {item.item_name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.asset_no || 'พัสดุคงทน (ต.)'} {item.brand ? `• ${item.brand}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleSelect(item.id)}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="นำรายการนี้ออก"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Due Date Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  กำหนดส่งคืน <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              {/* Purpose Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  วัตถุประสงค์ในการยืม <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="เช่น ยืมใช้งานสำหรับการประชุมคณะทำงานเขตสุขภาพที่ 7 ณ ห้องประชุมใหญ่..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-6 py-3.5 bg-slate-50/60 rounded-b-2xl">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isPending}
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSubmitBorrow}
                disabled={isPending || selectedItemsList.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isPending ? 'กำลังส่งคำขอ...' : 'ยืนยันการยื่นคำขอยืม'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
