'use client'

import { useState, useMemo, useTransition, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  ShoppingCart,
  Check,
  MapPin,
  Layers,
  Calendar,
  AlertCircle,
  X,
  PackageCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { CentralAvailableItem } from '@/features/disbursements/types'
import { submitBorrowRequest } from '@/features/disbursements/actions'
import { cn } from '@/lib/utils'
import { getPageNumbers } from '../pagination'
import { BorrowCartButton } from './borrow-cart-button'
import { useCartFlight } from './cart-flight-engine'
import { isReducedMotionPreferred } from './cart-flight-calc'

interface BorrowCatalogViewProps {
  cartContainer?: HTMLElement | null
  items: CentralAvailableItem[]
  searchQuery: string
  onSuccess?: (disbursementId: string) => void
  onSwitchToDocs?: () => void
}

export function BorrowCatalogView({
  cartContainer,
  items,
  searchQuery: q,
  onSuccess,
  onSwitchToDocs,
}: BorrowCatalogViewProps) {
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pagination, setPagination] = useState({ query: q, page: 1 })
  if (pagination.query !== q) setPagination({ query: q, page: 1 })
  const cardsViewport = useRef<HTMLDivElement>(null)
  const cartButtonRef = useRef<HTMLButtonElement>(null)
  const { triggerFlight, cartFlightOverlay } = useCartFlight()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [requestType, setRequestType] = useState<'issue' | 'borrow'>('borrow')
  const isBorrow = requestType === 'borrow'


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
  const submitting = useRef(false)

  // Filtered items
  const filteredItems = useMemo(() => {
    const query = q.trim().toLowerCase()
    return items.filter((item) => {
      if (selectedIds.has(item.id)) return false
      if (!query) return true

      const nameMatch = item.item_name.toLowerCase().includes(query)
      const assetMatch = item.asset_no?.toLowerCase().includes(query)
      const serialMatch = item.serial_no?.toLowerCase().includes(query)
      const brandMatch = item.brand?.toLowerCase().includes(query)
      const modelMatch = item.model?.toLowerCase().includes(query)
      const locMatch = item.location_name?.toLowerCase().includes(query)

      return Boolean(nameMatch || assetMatch || serialMatch || brandMatch || modelMatch || locMatch)
    })
  }, [items, q, selectedIds])

  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const currentPage = Math.min(pagination.query === q ? pagination.page : 1, totalPages)
  const pageItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function changePage(page: number) {
    setPagination({ query: q, page })
    cardsViewport.current?.scrollTo?.({ top: 0 })
  }

  // Toggle cart selection
  const handleToggleSelect = (item: CentralAvailableItem, source: HTMLElement) => {
    if (item.unavailable_reason || isPending) return

    const id = item.id
    const isCurrentlySelected = selectedIds.has(id)

    if (isCurrentlySelected) {
      // Remove from cart
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } else {
      if (selectedIds.size >= 20) {
        toast('เลือกได้สูงสุดไม่เกิน 20 รายการต่อคำขอ', 'warning')
        return
      }

      // Optimistic synchronous add
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
      if (cartButtonRef.current) {
        const cart = cartButtonRef.current
        triggerFlight(source, cart, {
          onArrive: () => {
            if (!cart.isConnected || isReducedMotionPreferred()) return
            cart.getAnimations?.().forEach(animation => animation.cancel())
            cart.animate?.([
              { transform: 'translateY(0) scale(1)' },
              { transform: 'translateY(2px) scale(1.06)', offset: 0.4 },
              { transform: 'translateY(0) scale(1)' },
            ], { duration: 240, easing: 'ease-out' })
          },
        })
      }
    }
  }

  // Selected items detail array
  const selectedItemsList = useMemo(() => {
    return items.filter((item) => selectedIds.has(item.id) && !item.unavailable_reason)
  }, [items, selectedIds])

  // Handle submit
  const handleSubmitBorrow = () => {
    if (submitting.current) return
    if (selectedItemsList.length === 0) {
      toast('กรุณาเลือกรายการที่ต้องการยืมอย่างน้อย 1 รายการ', 'warning')
      return
    }
    if (isBorrow && !dueDate) {
      setSubmitError('กรุณาระบุวันที่กำหนดส่งคืน')
      return
    }
    if (!purpose.trim()) {
      setSubmitError('กรุณาระบุวัตถุประสงค์ในการยืม')
      return
    }

    setSubmitError(null)
    submitting.current = true
    startTransition(async () => {
      try {
        const res = await submitBorrowRequest({
          item_ids: selectedItemsList.map((item) => item.id),
          request_type: requestType,
          due_date: isBorrow ? dueDate : null,
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
      } catch {
        setSubmitError('ส่งคำขอไม่สำเร็จ กรุณาลองใหม่')
      } finally {
        submitting.current = false
      }
    })
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden relative">
      {/* Ghost Animation Layer */}

      <div ref={cardsViewport} className="min-h-0 flex-1 overflow-auto bg-background p-4 sm:p-6">
        {/* Grid of items */}
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <div className="mb-3 rounded-full bg-muted p-4 text-muted-foreground">
              <PackageCheck className="h-8 w-8 stroke-1" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{selectedIds.size > 0 && !q ? 'เลือกรายการที่พร้อมใช้งานครบแล้ว' : 'ไม่พบพัสดุส่วนกลาง'}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {q ? 'ลองเปลี่ยนคำค้นหา' : selectedIds.size > 0 ? 'เปิดตะกร้าเพื่อตรวจสอบรายการและดำเนินการต่อ' : 'ขณะนี้ยังไม่มีพัสดุหรือครุภัณฑ์ส่วนกลางในระบบ'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {pageItems.map((item) => {
              const isSelected = selectedIds.has(item.id)
              return (
                <div
                  key={item.id}
                  data-cart-card
                  className={cn(
                    'group relative flex min-w-0 flex-col justify-between rounded-xl border bg-card p-4 shadow-sm transition-colors duration-150 select-none',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:shadow-md'
                  )}
                >
                  <div>
                    {/* Top status & tags */}
                    <div className="mb-2.5 flex items-center justify-between gap-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                          item.unavailable_reason
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-emerald-50 text-emerald-700'
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full shrink-0',
                            item.unavailable_reason ? 'bg-slate-400' : 'bg-emerald-500'
                          )}
                          aria-hidden="true"
                        />
                        {item.unavailable_reason || 'พร้อมเบิก/ยืม'}
                      </span>

                      {item.category?.name && (
                        <span className="max-w-[120px] truncate text-xs text-muted-foreground">
                          {item.category.name}
                        </span>
                      )}
                    </div>

                    {/* Item Image Preview or Icon */}
                    <div className="mb-3 flex h-36 w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt={item.item_name}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Layers className="h-10 w-10 stroke-1" />
                          <span className="mt-1 text-[11px]">ไม่มีรูปภาพ</span>
                        </div>
                      )}
                    </div>

                    {/* Title & Specs */}
                    <h4 className="font-medium text-foreground group-hover:text-primary line-clamp-2 text-sm leading-snug">
                      {item.item_name}
                    </h4>

                    {/* Asset Code / Monospace pill */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {item.asset_no ? (
                        <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                          {item.asset_no}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                          พัสดุคงทน (ต.)
                        </span>
                      )}
                    </div>

                    {/* Details metadata */}
                    <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                      {item.brand && (
                        <div className="whitespace-normal [overflow-wrap:anywhere]">
                          <span className="text-muted-foreground">ยี่ห้อ:</span> {item.brand}
                        </div>
                      )}
                      {item.model && (
                        <div className="whitespace-normal [overflow-wrap:anywhere]">
                          <span className="text-muted-foreground">รุ่น:</span> {item.model}
                        </div>
                      )}
                      {item.location_name && (
                        <div className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span>{item.location_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Select / Add-to-Cart Button */}
                  <div className="mt-4 pt-3 border-t border-border">
                    <button
                      data-cart-btn
                      type="button"
                      aria-label={
                        isSelected
                          ? `นำ ${item.item_name} ออกจากตะกร้า`
                          : `ใส่ ${item.item_name} ลงในตะกร้า`
                      }
                      aria-pressed={isSelected}
                      disabled={
                        isPending ||
                        Boolean(item.unavailable_reason) ||
                        (!isSelected && selectedIds.size >= 20)
                      }
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleSelect(item, e.currentTarget)
                      }}
                      className={cn(
                        'flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition cursor-pointer',
                        isSelected
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'bg-muted text-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      {isSelected ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          อยู่ในตะกร้าแล้ว
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-3.5 w-3.5" />
                          {item.unavailable_reason ? 'ยังไม่พร้อมเบิก/ยืม' : 'ใส่ตะกร้า'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {cartFlightOverlay}
      {cartContainer && createPortal(
        <BorrowCartButton
          buttonRef={cartButtonRef}
          count={selectedItemsList.length}
          onClick={() => { setSubmitError(null); setIsModalOpen(true) }}
          className="h-9 shrink-0"
        />,
        cartContainer
      )}

      {/* Pagination Footer */}
      <footer className="flex min-h-12 flex-wrap gap-3 py-2.5 shrink-0 items-center justify-between border-t border-border bg-card px-4 text-xs text-muted-foreground shadow-inner z-10 min-w-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          <span
            aria-live="polite"
            className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-bold text-card-foreground shrink-0"
          >
            {filteredItems.length
              ? `แสดง ${(currentPage - 1) * pageSize + 1}–${Math.min(
                  currentPage * pageSize,
                  filteredItems.length
                )} จาก ${filteredItems.length.toLocaleString()} รายการ`
              : 'แสดง 0 จาก 0 รายการ'}
          </span>
        </div>
        <nav aria-label="แบ่งหน้าพัสดุเบิกยืม" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs font-semibold"
            aria-label="หน้าก่อนหน้า"
            disabled={currentPage <= 1 || isPending}
            onClick={() => changePage(currentPage - 1)}
          >
            ก่อนหน้า
          </Button>
          <div className="flex items-center gap-1">
            {getPageNumbers(currentPage, totalPages).map((pageItem, index) =>
              pageItem === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-1.5 text-xs text-muted-foreground select-none"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <button
                  key={pageItem}
                  type="button"
                  disabled={isPending}
                  onClick={() => changePage(pageItem)}
                  aria-current={pageItem === currentPage ? 'page' : undefined}
                  aria-label={`หน้า ${pageItem}`}
                  className={cn(
                    'flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring',
                    pageItem === currentPage
                      ? 'border-primary/40 bg-primary/10 text-primary shadow-xs font-bold'
                      : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {pageItem}
                </button>
              )
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs font-semibold"
            aria-label="หน้าถัดไป"
            disabled={currentPage >= totalPages || isPending}
            onClick={() => changePage(currentPage + 1)}
          >
            ถัดไป
          </Button>
        </nav>
      </footer>

      {/* Borrow Request Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
          onClick={() => !isPending && setIsModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="แบบฟอร์มเบิกหรือยืมพัสดุ"
            onClick={(event) => event.stopPropagation()}
            className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
              <div
                role="tablist"
                aria-label="ประเภทคำขอ"
                className="flex min-w-0 flex-1 gap-1 rounded-xl border border-border bg-muted/60 p-1"
              >
                {(['issue', 'borrow'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="tab"
                    aria-selected={requestType === type}
                    disabled={isPending}
                    onClick={() => {
                      setRequestType(type)
                      setSubmitError(null)
                    }}
                    className={cn(
                      'min-h-10 min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                      requestType === type
                        ? 'border-primary/40 bg-primary/10 text-primary shadow-xs'
                        : 'border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground'
                    )}
                  >
                    {type === 'issue' ? 'เบิกสิ่งของ' : 'ยืมสิ่งของ'}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 overflow-y-auto px-4 pb-4 pt-2 space-y-5 sm:px-6 sm:pb-6">
              {submitError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>{submitError}</div>
                </div>
              )}

              {/* Selected Items List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">รายการที่เลือก</span>
                  <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    {selectedItemsList.length} รายการ
                  </span>
                </div>
                <div className="max-h-44 overflow-y-auto divide-y divide-border rounded-xl border border-border bg-background">
                  {selectedItemsList.length === 0 && (
                    <p className="px-4 py-6 text-center text-xs text-muted-foreground">ยังไม่มีรายการในตะกร้า ปิดหน้าต่างเพื่อเลือกสิ่งของก่อนส่งคำขอ</p>
                  )}
                  {selectedItemsList.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-3 text-xs hover:bg-muted/30"
                    >
                      <div className="min-w-0 flex-1 pr-2 text-left">
                        <div className="font-medium leading-relaxed text-foreground break-words">
                          {item.item_name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground break-words">
                          {item.asset_no || 'พัสดุคงทน (ต.)'} {item.brand ? `• ${item.brand}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev)
                            next.delete(item.id)
                            return next
                          })
                        }}
                        disabled={isPending}
                        aria-label={`นำ ${item.item_name} ออกจากรายการ`}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        title="นำรายการนี้ออก"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Due Date Input */}
              {isBorrow && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="central-request-due-date"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                  >
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    กำหนดส่งคืน <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="central-request-due-date"
                    type="date"
                    value={dueDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={isPending}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 sm:max-w-60"
                    required
                  />
                </div>
              )}

              {/* Purpose Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="central-request-purpose"
                  className="block text-xs font-semibold text-foreground"
                >
                  วัตถุประสงค์ในการ{isBorrow ? 'ยืม' : 'เบิก'} <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="central-request-purpose"
                  rows={3}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="ระบุวัตถุประสงค์การใช้งาน..."
                  disabled={isPending}
                  className="min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
                  required
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div
              data-footer
              className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-muted/20 px-4 py-3 sm:px-6"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isPending}
                className="h-9 flex-1 rounded-lg text-xs sm:flex-none sm:px-4"
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSubmitBorrow}
                disabled={isPending || selectedItemsList.length === 0}
                className="h-9 flex-1 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 sm:flex-none sm:px-5"
              >
                {isPending ? 'กำลังส่งคำขอ...' : isBorrow ? 'ยืนยันคำขอยืม' : 'ยืนยันคำขอเบิก'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
