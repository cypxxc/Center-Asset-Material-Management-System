'use client'

import { useState, useMemo, useTransition, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Dialog, DropdownMenu, Tooltip } from 'radix-ui'
import {
  ShoppingCart,
  Check,
  MapPin,
  Layers,
  Calendar,
  AlertCircle,
  X,
  PackageCheck,
  ChevronDown,
  Loader2,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { CentralAvailableItem } from '@/features/disbursements/types'
import { submitBorrowRequest, recoverCartRequest } from '@/features/disbursements/actions'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getPageNumbers } from '../pagination'
import { BorrowCartButton } from './borrow-cart-button'
import { useCartFlight } from './cart-flight-engine'
import { cartRetryPayload, parseCartRetry } from '../cart-retry'
import { TruncatedTextTooltip } from '@/components/ui/truncated-text-tooltip'

interface BorrowCatalogViewProps {
  catalogType?: 'asset' | 'material'
  cartContainer?: HTMLElement | null
  items: CentralAvailableItem[]
  searchQuery: string
  onSuccess?: (disbursementId: string) => void
  onSwitchToDocs?: () => void
}

export function BorrowCatalogView({
  catalogType,
  cartContainer,
  items,
  searchQuery: q,
  onSuccess,
  onSwitchToDocs,
}: BorrowCatalogViewProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [pendingRecovery, setPendingRecovery] = useState<ReturnType<typeof parseCartRetry>>(null)
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        setPendingRecovery(parseCartRetry(sessionStorage.getItem('camms-pending-cart-request')))
      } catch {
        // A blocked storage read leaves the catalog usable.
      }
    })
    return () => { active = false }
  }, [])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedSnapshots, setSelectedSnapshots] = useState<Record<string, CentralAvailableItem>>({})
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [itemActions, setItemActions] = useState<Record<string, 'issue' | 'borrow'>>({})
  const [pagination, setPagination] = useState({ query: q, page: 1 })
  if (pagination.query !== q) setPagination({ query: q, page: 1 })
  const cardsViewport = useRef<HTMLDivElement>(null)
  const cartButtonRef = useRef<HTMLButtonElement>(null)
  const { triggerFlight, cartFlightOverlay } = useCartFlight()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<CentralAvailableItem | null>(null)
  const isBorrow = items.some(item => selectedIds.has(item.id) && item.item_type !== 'material' && (itemActions[item.id] ?? 'borrow') === 'borrow')


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
  const retryRequest = useRef<{ payload: string; key: string } | null>(null)

  // Filtered items
  const filteredItems = useMemo(() => {
    const query = q.trim().toLowerCase()
    return items.filter((item) => {
      if (catalogType && item.item_type !== catalogType) return false
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
  }, [items, q, selectedIds, catalogType])

  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const currentPage = Math.min(pagination.query === q ? pagination.page : 1, totalPages)
  const pageItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function changePage(page: number) {
    setPagination({ query: q, page })
    cardsViewport.current?.scrollTo?.({ top: 0 })
  }

  const handleRecover = async () => {
    if (!pendingRecovery?.key) return
    const res = await recoverCartRequest(pendingRecovery.key)
    if (res.success && res.data?.id) {
      try { sessionStorage.removeItem('camms-pending-cart-request') } catch {}
      setPendingRecovery(null)
      router.push(`/disbursements/batches/${res.data.id}`)
    }
  }

  // Toggle cart selection
  const handleToggleSelect = (item: CentralAvailableItem, source: HTMLElement) => {
    if (item.unavailable_reason || isPending || !cartButtonRef.current) return

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
      setQuantities(previous => ({ ...previous, [id]: 1 }))
      if (selectedIds.size >= 20) {
        toast('เลือกได้สูงสุดไม่เกิน 20 รายการต่อคำขอ', 'warning')
        return
      }

      // Optimistic synchronous add
      setSelectedSnapshots(previous => ({ ...previous, [id]: item }))
      setItemActions(previous => ({ ...previous, [id]: items.find(item => item.id === id)?.item_type === 'material' ? 'issue' : 'borrow' }))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
      if (cartButtonRef.current) {
        const cart = cartButtonRef.current
        const preview = source.closest('[data-cart-card]')?.querySelector<HTMLElement>('[data-cart-preview]')
        triggerFlight(preview ?? source, cart, {
          motion: 'full',
          imageUrl: item.image_url,
          onArrive: () => {
            if (!cart.isConnected) return
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
    return [...selectedIds].map(id => items.find(item => item.id === id) ?? (selectedSnapshots[id] ? {
      ...selectedSnapshots[id], quantity: 0, unavailable_reason: 'รายการนี้ไม่พร้อมใช้งานแล้ว กรุณานำออกจากตะกร้า',
    } : null)).filter((item): item is CentralAvailableItem => item !== null)
  }, [items, selectedIds, selectedSnapshots])

  // Grouped item lists by transaction type for display
  const borrowAssets = useMemo(
    () => selectedItemsList.filter((item) => item.item_type !== 'material' && (itemActions[item.id] ?? 'borrow') === 'borrow'),
    [selectedItemsList, itemActions]
  )
  const issueAssets = useMemo(
    () => selectedItemsList.filter((item) => item.item_type !== 'material' && (itemActions[item.id] ?? 'borrow') === 'issue'),
    [selectedItemsList, itemActions]
  )
  const issueMaterials = useMemo(
    () => selectedItemsList.filter((item) => item.item_type === 'material'),
    [selectedItemsList]
  )

  // Handle submit
  const handleSubmitBorrow = () => {
    if (submitting.current) return
    if (selectedItemsList.length !== selectedIds.size || selectedItemsList.some(item => item.unavailable_reason)) {
      setSubmitError('รายการในตะกร้ามีข้อมูลเปลี่ยนแปลง กรุณาตรวจสอบสถานะและจำนวนพร้อมจ่ายอีกครั้ง')
      return
    }
    if (selectedItemsList.length === 0) {
      toast('กรุณาเลือกรายการที่ต้องการยืมอย่างน้อย 1 รายการ', 'warning')
      return
    }
    if (isBorrow) {
      if (!dueDate) {
        setSubmitError('กรุณาระบุวันที่กำหนดส่งคืน')
        return
      }
      const today = new Date().toISOString().split('T')[0]
      if (dueDate < today) {
        setSubmitError('วันที่กำหนดส่งคืนต้องไม่เป็นวันที่ย้อนหลัง')
        return
      }
    }
    if (!purpose.trim()) {
      setSubmitError('กรุณาระบุวัตถุประสงค์ในการยืม')
      return
    }

    setSubmitError(null)
    for (const item of selectedItemsList) {
      const quantity = quantities[item.id] ?? 1
      if (!Number.isInteger(quantity) || quantity < 1) {
        setSubmitError(`${item.item_name}: จำนวนขอเบิกต้องมากกว่า 0`)
        return
      }
      if (quantity > item.quantity) {
        setSubmitError(`${item.item_name} พร้อมจ่าย ${item.quantity} ${item.unit_name || 'หน่วย'} กรุณาตรวจสอบจำนวนที่ขอ`)
        return
      }
    }
    submitting.current = true
    startTransition(async () => {
      try {
        const payload = {
          item_ids: selectedItemsList.map((item) => item.id).sort(),
          quantities: Object.fromEntries(selectedItemsList.map(item => [item.id, quantities[item.id] ?? 1])),
          item_actions: Object.fromEntries(selectedItemsList.map(item => [item.id, item.item_type === 'material' ? 'issue' : itemActions[item.id] ?? 'borrow'])),
          request_type: isBorrow ? 'borrow' as const : 'issue' as const,
          due_date: isBorrow ? dueDate : null,
          purpose: purpose.trim(),
        }
        const serialized = cartRetryPayload(payload)
        if (!retryRequest.current) {
          try { retryRequest.current = parseCartRetry(sessionStorage.getItem('camms-pending-cart-request')) } catch { /* Storage may be unavailable. */ }
        }
        if (retryRequest.current?.payload !== serialized) retryRequest.current = { payload: serialized, key: crypto.randomUUID() }
        try { sessionStorage.setItem('camms-pending-cart-request', JSON.stringify(retryRequest.current)) } catch { /* In-memory retry remains available. */ }
        const res = await submitBorrowRequest({ ...payload, request_key: retryRequest.current.key })

        if (!res.success) {
          setSubmitError(res.error || 'เกิดข้อผิดพลาดในการส่งคำขอ')
          toast(res.error || 'เกิดข้อผิดพลาดในการส่งคำขอ', 'error')
          return
        }

        toast(res.data?.ids && res.data.ids.length > 1 ? `ส่งคำขอสำเร็จ ${res.data.ids.length} เอกสาร แยกตามการทำรายการแล้ว รอผู้ดูแลอนุมัติ` : res.message || 'ส่งคำขอเรียบร้อยแล้ว รอผู้ดูแลระบบอนุมัติ', 'success')
        setIsModalOpen(false)
        setSelectedIds(new Set())
        setSelectedSnapshots({})
        setItemActions({})
        setQuantities({})
        setPurpose('')
        retryRequest.current = null
        try { sessionStorage.removeItem('camms-pending-cart-request') } catch { /* Storage may be unavailable. */ }

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

  const renderCartItemCard = (item: CentralAvailableItem) => {
    const isMaterial = item.item_type === 'material'
    const brandModel = [item.brand?.trim(), item.model?.trim()].filter(Boolean).join(' ')
    const action = itemActions[item.id] ?? 'borrow'

    return (
      <div
        key={item.id}
        className={cn(
          'group relative flex items-start gap-2.5 rounded-lg border p-2 sm:p-2.5 shadow-2xs transition-colors',
          item.unavailable_reason
            ? 'border-destructive/30 bg-destructive/5'
            : 'border-border/70 bg-card hover:border-border'
        )}
      >
        {/* Thumbnail or Fallback Icon */}
        <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/50 bg-muted/40">
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt={item.item_name}
              className="h-full w-full object-contain p-0.5"
              loading="lazy"
            />
          ) : (
            <Layers className="size-4 text-muted-foreground/60 stroke-1" />
          )}
        </div>

        {/* Item Content */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-start justify-between gap-1.5">
            <TruncatedTextTooltip
              text={item.item_name}
              as="div"
              className="truncate font-semibold text-xs text-foreground leading-tight"
            />
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
              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 cursor-pointer -mt-0.5 -mr-0.5"
            >
              <X className="size-3" />
            </button>
          </div>

          {/* Secondary Text: Code, Brand/Model, Location */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
            {isMaterial ? (
              <span className="font-mono text-foreground/80 font-medium shrink-0">วัสดุ</span>
            ) : item.asset_no ? (
              <>
                <TruncatedTextTooltip
                  text={item.asset_no}
                  as="span"
                  className="font-mono text-foreground/80 font-medium truncate max-w-[130px] shrink-0"
                />
                {item.serial_no && (
                  <TruncatedTextTooltip
                    text={`S/N: ${item.serial_no}`}
                    as="span"
                    className="font-mono text-muted-foreground/80 truncate max-w-[110px] shrink-0"
                  />
                )}
              </>
            ) : item.serial_no ? (
              <TruncatedTextTooltip
                text={`S/N: ${item.serial_no}`}
                as="span"
                className="font-mono text-foreground/80 font-medium truncate max-w-[130px] shrink-0"
              />
            ) : (
              <span className="font-mono text-foreground/80 font-medium shrink-0">ครุภัณฑ์</span>
            )}
            {brandModel && (
              <TruncatedTextTooltip
                text={`• ${brandModel}`}
                as="span"
                className="truncate text-muted-foreground/80 max-w-[130px]"
              />
            )}
            {item.location_name && (
              <TruncatedTextTooltip
                text={`• ${item.location_name}`}
                as="span"
                className="hidden md:inline truncate text-muted-foreground/60 max-w-[120px]"
              />
            )}
          </div>

          {item.unavailable_reason && (
            <TruncatedTextTooltip
              text={item.unavailable_reason}
              as="p"
              className="text-[11px] font-medium text-destructive truncate max-w-full"
            />
          )}

          {/* Controls: Type / Quantity */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {isMaterial ? (
              <>
                <span className="sr-only">การทำรายการ: เบิกวัสดุ</span>
                <span className="text-[11px] text-muted-foreground">
                  คงเหลือ {item.quantity} {item.unit_name || 'หน่วย'}
                </span>

                <label className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                  <span className="text-muted-foreground font-normal text-[11px]">จำนวน:</span>
                  <input
                    aria-label={`จำนวนขอเบิก ${item.item_name}`}
                    type="number"
                    min={1}
                    max={item.quantity}
                    step={1}
                    disabled={isPending || !!item.unavailable_reason}
                    value={quantities[item.id] ?? 1}
                    onChange={(event) =>
                      setQuantities((previous) => ({
                        ...previous,
                        [item.id]: Number(event.target.value),
                      }))
                    }
                    className="h-6 w-14 rounded border border-input bg-background px-1.5 text-right tabular-nums text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <span className="text-muted-foreground text-[11px] font-normal">{item.unit_name || 'หน่วย'}</span>
                </label>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        aria-label={`การทำรายการ ${item.item_name}`}
                        disabled={isPending || !!item.unavailable_reason}
                        className={cn(
                          'group inline-flex h-5.5 items-center gap-1 rounded px-1.5 text-[11px] font-semibold border transition-colors outline-none cursor-pointer disabled:opacity-50',
                          action === 'borrow'
                            ? 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/15'
                            : 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/15'
                        )}
                      >
                        <span>{action === 'borrow' ? 'ยืม' : 'เบิก'}</span>
                        <ChevronDown className="h-2.5 w-2.5 opacity-60" aria-hidden="true" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        align="start"
                        sideOffset={4}
                        className="z-[70] min-w-[120px] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
                      >
                        <DropdownMenu.RadioGroup
                          value={action}
                          onValueChange={(value) => {
                            setItemActions((previous) => ({
                              ...previous,
                              [item.id]: value as 'issue' | 'borrow',
                            }))
                            setSubmitError(null)
                          }}
                        >
                          {([
                            { value: 'borrow', label: 'ยืม' },
                            { value: 'issue', label: 'เบิก' },
                          ] as const).map((opt) => (
                            <DropdownMenu.RadioItem
                              key={opt.value}
                              value={opt.value}
                              className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-xs font-medium outline-none data-[highlighted]:bg-muted data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary"
                            >
                              <span>{opt.label}</span>
                              <DropdownMenu.ItemIndicator>
                                <Check className="h-3 w-3 text-primary" aria-hidden="true" />
                              </DropdownMenu.ItemIndicator>
                            </DropdownMenu.RadioItem>
                          ))}
                        </DropdownMenu.RadioGroup>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>

                <span className="text-[11px] text-muted-foreground font-mono">
                  1 {item.unit_name || 'รายการ'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden relative">
      {pendingRecovery && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs">
          <span className="text-muted-foreground">มีรายการคำขอที่รอดำเนินการหรือตรวจสอบ</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRecover}
            className="h-7 text-xs font-semibold"
          >
            ตรวจสอบคำขอที่ส่งล่าสุด
          </Button>
        </div>
      )}
      {/* Ghost Animation Layer */}

      <div ref={cardsViewport} className="min-h-0 flex-1 overflow-auto bg-background p-4 sm:p-6">
        {/* Grid of items */}
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 text-center">
            <div className="mb-3 rounded-full bg-muted p-4 text-muted-foreground">
              <PackageCheck className="h-8 w-8 stroke-1" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{selectedIds.size > 0 && !q ? 'เลือกรายการที่พร้อมใช้งานครบแล้ว' : 'ไม่พบวัสดุส่วนกลาง'}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {q ? 'ลองเปลี่ยนคำค้นหา' : selectedIds.size > 0 ? 'เปิดตะกร้าเพื่อตรวจสอบรายการและดำเนินการต่อ' : 'ขณะนี้ยังไม่มีวัสดุหรือครุภัณฑ์ส่วนกลางในระบบ'}
            </p>
          </div>
        ) : (
          <Tooltip.Provider delayDuration={150} skipDelayDuration={100}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-4">
              {pageItems.map((item) => {
                const isSelected = selectedIds.has(item.id)
                const brandModel = [item.brand?.trim(), item.model?.trim()].filter(Boolean).join(' ')
                return (
                  <div
                    key={item.id}
                    data-cart-card
                    onClick={() => setDetailItem(item)}
                    className={cn(
                      'group relative flex min-w-0 flex-col justify-between rounded-xl border bg-card p-3 shadow-xs transition duration-150 select-none cursor-pointer',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:shadow-md'
                    )}
                  >
                    <div>
                      {/* Top status & Material Stock Badge */}
                      <div className="mb-2 flex items-center justify-between gap-1.5 min-w-0">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none shrink-0',
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
                          <TruncatedTextTooltip
                            text={item.unavailable_reason || 'พร้อมเบิก/ยืม'}
                            as="span"
                            className="truncate max-w-[100px]"
                          />
                        </span>

                        {item.item_type === 'material' && (
                          item.quantity > 0 ? (
                            <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground/80 border border-border/50 shrink-0 leading-none">
                              คงเหลือ {item.quantity} {item.unit_name || 'หน่วย'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200/60 shrink-0 leading-none">
                              หมด
                            </span>
                          )
                        )}
                      </div>

                      {/* Item Image Preview or Icon */}
                      <div data-cart-preview className="mb-2.5 flex h-28 w-full items-center justify-center overflow-hidden rounded-lg bg-muted/40 p-1">
                        {item.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image_url}
                            alt={item.item_name}
                            className="max-h-full max-w-full object-contain transition duration-150 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <Layers className="h-8 w-8 stroke-1" />
                            <span className="mt-1 text-[10px]">ไม่มีรูปภาพ</span>
                          </div>
                        )}
                      </div>

                      {/* Title & Brand */}
                      <TruncatedTextTooltip
                        text={item.item_name}
                        as="h4"
                        className="font-medium text-foreground group-hover:text-primary truncate text-xs leading-snug cursor-pointer block w-full"
                      />
                      {item.item_type !== 'material' && brandModel ? (
                        <TruncatedTextTooltip
                          text={brandModel}
                          as="p"
                          className="mt-0.5 truncate text-[11px] text-muted-foreground cursor-pointer block w-full"
                        />
                      ) : (
                        <p className="mt-0.5 text-[11px] text-transparent select-none leading-normal" aria-hidden="true">
                          &nbsp;
                        </p>
                      )}
                    </div>

                    {/* Bottom Select / Add-to-Cart Button */}
                    <div className="mt-2.5 pt-2 border-t border-border">
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
                          !cartContainer ||
                          isPending ||
                          Boolean(item.unavailable_reason) ||
                          (!isSelected && selectedIds.size >= 20)
                        }
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleSelect(item, e.currentTarget)
                        }}
                        className={cn(
                          'flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition cursor-pointer',
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
                            {item.unavailable_reason ? 'ยังไม่พร้อม' : 'ใส่ตะกร้า'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Tooltip.Provider>
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
        <nav aria-label="แบ่งหน้าวัสดุเบิกยืม" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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

      {/* Both panels share one focus and dismissal scope. */}
      <Dialog.Root open={isModalOpen} onOpenChange={(open) => { if (!isPending) setIsModalOpen(open) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs animate-in fade-in-0 duration-150" />
          <Dialog.Content
            aria-describedby="cart-modal-description"
            onCloseAutoFocus={(event) => { event.preventDefault(); cartButtonRef.current?.focus() }}
            className="fixed left-1/2 top-1/2 z-50 flex flex-col max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] max-w-xl lg:max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl focus:outline-none lg:h-[min(42rem,calc(100dvh-3rem))] animate-in fade-in-0 zoom-in-95 duration-150"
          >
            {/* Main Header */}
            <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShoppingCart className="size-4" />
                </div>
                <div className="min-w-0">
                  <Dialog.Title className="text-sm sm:text-base font-semibold text-foreground leading-none truncate">
                    สร้างคำขอเบิก–ยืม
                  </Dialog.Title>
                  <Dialog.Description id="cart-modal-description" className="sr-only">
                    สร้างคำขอเบิก–ยืม
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  aria-label="ปิดตะกร้า"
                  className="size-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                >
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </header>

            {/* Modal Body: 2 Columns on Desktop, 1 Column on Mobile */}
            <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border">
              {/* Left Column: Selected Items List (Scrolls independently on desktop) */}
              <section
                aria-labelledby="cart-selected-heading"
                className="flex min-h-0 flex-col overflow-hidden bg-muted/10 lg:h-full"
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2.5 sm:px-5">
                  <h3 id="cart-selected-heading" className="text-xs font-semibold text-foreground">
                    รายการที่เลือก ({selectedItemsList.length}/20)
                  </h3>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5 sm:p-4 space-y-3.5">
                  {selectedItemsList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-2">
                        <ShoppingCart className="size-5 stroke-1" />
                      </div>
                      <p className="text-xs font-medium text-foreground">ยังไม่มีรายการในตะกร้า</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">ปิดหน้าต่างเพื่อเลือกสิ่งของก่อนส่งคำขอ</p>
                    </div>
                  ) : (
                    <>
                      {/* Group 1: ครุภัณฑ์ */}
                      {borrowAssets.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="pb-0.5 pt-0.5">
                            <h4 className="text-xs font-semibold text-muted-foreground">
                              ครุภัณฑ์ ({borrowAssets.length})
                            </h4>
                          </div>
                          <div className="space-y-1.5">
                            {borrowAssets.map(renderCartItemCard)}
                          </div>
                        </div>
                      )}

                      {/* Group 2: วัสดุ */}
                      {issueMaterials.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="pb-0.5 pt-0.5">
                            <h4 className="text-xs font-semibold text-muted-foreground">
                              วัสดุ ({issueMaterials.length})
                            </h4>
                          </div>
                          <div className="space-y-1.5">
                            {issueMaterials.map(renderCartItemCard)}
                          </div>
                        </div>
                      )}

                      {/* Group 3: ครุภัณฑ์ (เบิก) ถ้ามี */}
                      {issueAssets.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="pb-0.5 pt-0.5">
                            <h4 className="text-xs font-semibold text-muted-foreground">
                              ครุภัณฑ์ (เบิก) ({issueAssets.length})
                            </h4>
                          </div>
                          <div className="space-y-1.5">
                            {issueAssets.map(renderCartItemCard)}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* Right Column: Request Details Form */}
              <section
                aria-label="ข้อมูลคำขอ"
                className="flex min-h-0 flex-col overflow-hidden bg-card lg:h-full"
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2.5 sm:px-5">
                  <h3 className="text-xs font-semibold text-foreground">
                    ข้อมูลคำขอ
                  </h3>
                </div>

                <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain p-4 sm:p-5">
                  {/* Error Alert */}
                  {submitError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive animate-in fade-in"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="flex-1 font-medium leading-relaxed">{submitError}</div>
                    </div>
                  )}

                  {/* Due Date Input (Only when isBorrow) */}
                  {isBorrow && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <label
                          htmlFor="central-request-due-date"
                          className="flex items-center gap-1 text-xs font-semibold text-foreground"
                        >
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>กำหนดคืน</span>
                          <span className="sr-only">รายการที่ยืม</span>
                          <span className="text-destructive">*</span>
                        </label>
                        <TruncatedTextTooltip
                          text="กำหนดส่งคืนครุภัณฑ์ตามระเบียบพัสดุ (ห้ามเลือกวันที่ย้อนหลัง)"
                          alwaysShow
                          as="span"
                          className="cursor-help text-muted-foreground/70 hover:text-foreground inline-flex items-center"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </TruncatedTextTooltip>
                      </div>
                      <input
                        id="central-request-due-date"
                        type="date"
                        value={dueDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => {
                          setDueDate(e.target.value)
                          setSubmitError(null)
                        }}
                        disabled={isPending}
                        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs sm:text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
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
                      วัตถุประสงค์ <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      id="central-request-purpose"
                      rows={3}
                      value={purpose}
                      onChange={(e) => {
                        setPurpose(e.target.value)
                        setSubmitError(null)
                      }}
                      placeholder="ระบุวัตถุประสงค์การใช้งาน..."
                      disabled={isPending}
                      className="h-20 sm:h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                      required
                    />
                  </div>

                  <span className="sr-only">ระบบจะแยกเอกสารให้เมื่อยืนยัน</span>
                </div>
              </section>
            </div>

            {/* Pinned Sticky Footer */}
            <footer
              data-footer
              className="flex shrink-0 flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-6"
            >
              <div className="text-xs font-medium text-foreground">
                <span>{selectedItemsList.length} รายการ</span>
                {borrowAssets.length > 0 && (
                  <span className="text-muted-foreground"> · ยืม {borrowAssets.length}</span>
                )}
                {(issueMaterials.length > 0 || issueAssets.length > 0) && (
                  <span className="text-muted-foreground">
                    {' '}· เบิก {issueMaterials.length + issueAssets.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                  className="h-9 flex-1 sm:flex-none sm:px-4 rounded-lg text-xs font-medium cursor-pointer"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSubmitBorrow}
                  disabled={isPending || selectedItemsList.length === 0}
                  className="h-9 flex-1 sm:flex-none sm:px-5 rounded-lg text-xs font-semibold cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      กำลังส่งคำขอ...
                    </>
                  ) : (
                    'ยืนยันคำขอ'
                  )}
                </Button>
              </div>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Item Detail Modal */}
      <Dialog.Root open={Boolean(detailItem)} onOpenChange={(open) => { if (!open) setDetailItem(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs animate-in fade-in-0 duration-150" />
          <Dialog.Content
            data-cart-card
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl focus:outline-none animate-in fade-in-0 zoom-in-95 duration-150"
          >
            {/* Header with Title & Close (X) button */}
            <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
              <Dialog.Title className="text-base font-semibold text-foreground">
                รายละเอียดสิ่งของ
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="ปิดหน้าต่าง"
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </div>

            {detailItem && (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
                  {/* Large Image View */}
                  <div data-cart-preview className="flex h-56 sm:h-64 w-full items-center justify-center overflow-hidden rounded-xl bg-muted/30 border border-border/50 p-2">
                    {detailItem.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={detailItem.image_url}
                        alt={detailItem.item_name}
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Layers className="h-12 w-12 stroke-1" />
                        <span className="mt-2 text-xs">ไม่มีรูปภาพ</span>
                      </div>
                    )}
                  </div>

                  {/* Title & Badges */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                          detailItem.unavailable_reason
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-emerald-50 text-emerald-700'
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full shrink-0',
                            detailItem.unavailable_reason ? 'bg-slate-400' : 'bg-emerald-500'
                          )}
                          aria-hidden="true"
                        />
                        {detailItem.unavailable_reason || 'พร้อมเบิก/ยืม'}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {detailItem.item_type === 'material' ? 'วัสดุ' : 'ครุภัณฑ์'}
                      </span>
                      {detailItem.category?.name && (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {detailItem.category.name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-foreground leading-snug break-words">
                      {detailItem.item_name}
                    </h3>
                  </div>

                  {/* Details Data List (Filter out empty/null/undefined rows) */}
                  <div className="divide-y divide-border rounded-xl border border-border bg-muted/20 text-xs">
                    {detailItem.asset_no && (
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <span className="text-muted-foreground shrink-0">รหัสครุภัณฑ์</span>
                        <span className="font-mono font-medium text-foreground text-right break-all">
                          {detailItem.asset_no}
                        </span>
                      </div>
                    )}
                    {detailItem.serial_no && (
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <span className="text-muted-foreground shrink-0">Serial Number</span>
                        <span className="font-mono text-foreground text-right break-all">
                          {detailItem.serial_no}
                        </span>
                      </div>
                    )}
                    {detailItem.category?.name && (
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <span className="text-muted-foreground shrink-0">หมวดหมู่</span>
                        <span className="text-foreground text-right">{detailItem.category.name}</span>
                      </div>
                    )}
                    {detailItem.brand && (
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <span className="text-muted-foreground shrink-0">ยี่ห้อ</span>
                        <span className="text-foreground text-right break-words">{detailItem.brand}</span>
                      </div>
                    )}
                    {detailItem.model && (
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <span className="text-muted-foreground shrink-0">รุ่น</span>
                        <span className="text-foreground text-right break-words">{detailItem.model}</span>
                      </div>
                    )}
                    {detailItem.location_name && (
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <span className="text-muted-foreground shrink-0 flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          สถานที่จัดเก็บ
                        </span>
                        <span className="text-foreground text-right break-words">{detailItem.location_name}</span>
                      </div>
                    )}
                    {detailItem.item_type === 'material' && detailItem.quantity != null && (
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <span className="text-muted-foreground shrink-0">จำนวนคงเหลือ</span>
                        <span className="font-semibold text-foreground text-right">
                          {detailItem.quantity} {detailItem.unit_name || 'หน่วย'}
                        </span>
                      </div>
                    )}
                    {detailItem.item_type === 'material' && detailItem.unit_name && (
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <span className="text-muted-foreground shrink-0">หน่วยนับ</span>
                        <span className="text-foreground text-right">{detailItem.unit_name}</span>
                      </div>
                    )}
                    {detailItem.item_type === 'material' && detailItem.specification?.trim() && (
                      <div className="flex flex-col gap-1 px-3.5 py-2.5">
                        <span className="text-muted-foreground">ขนาดหรือลักษณะ</span>
                        <span className="text-foreground whitespace-pre-wrap break-words">{detailItem.specification.trim()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer with Actions */}
                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDetailItem(null)}
                    className="h-9 rounded-lg text-xs cursor-pointer"
                  >
                    ปิด
                  </Button>
                  {(() => {
                    const isDetailSelected = selectedIds.has(detailItem.id)
                    return (
                      <Button
                        data-cart-btn
                        type="button"
                        size="sm"
                        disabled={
                          !cartContainer ||
                          isPending ||
                          Boolean(detailItem.unavailable_reason) ||
                          (!isDetailSelected && selectedIds.size >= 20)
                        }
                        onClick={(e) => {
                          handleToggleSelect(detailItem, e.currentTarget)
                        }}
                        className={cn(
                          'h-9 rounded-lg text-xs font-semibold gap-1.5 cursor-pointer',
                          isDetailSelected
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
                        )}
                      >
                        {isDetailSelected ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            อยู่ในตะกร้าแล้ว
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="h-3.5 w-3.5" />
                            {detailItem.unavailable_reason ? 'ยังไม่พร้อม' : 'ใส่ตะกร้า'}
                          </>
                        )}
                      </Button>
                    )
                  })()}
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
