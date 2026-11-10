'use client'

import { useState, useTransition, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Activity,
  Boxes,
  Plus,
  RotateCcw,
  ArrowRight,
  Clock,
  FileEdit,
  CheckCircle2,
  Tag,
  X,
} from 'lucide-react'
import { formatDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { FilterDropdown, type FilterOption } from '@/components/ui/filter-dropdown'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableCell,
} from '@/components/ui/data-table'
import type { DisbursementRow } from '@/features/disbursements/types'
import {
  DisbursementStatusBadge,
  DisbursementTypeBadge,
} from '@/features/disbursements/components/badges'
import {
  DISBURSEMENT_TYPE_LABELS,
  DISBURSEMENT_STATUS_LABELS,
} from '@/features/disbursements/print-generator'

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

const DISBURSEMENT_STATUS_OPTIONS: FilterOption[] = [
  { value: 'draft', label: 'ฉบับร่าง', colorDot: 'bg-slate-400' },
  { value: 'confirmed', label: 'ยืนยันแล้ว', colorDot: 'bg-emerald-500' },
  { value: 'active_borrow', label: 'กำลังยืม', colorDot: 'bg-amber-500' },
  { value: 'partially_returned', label: 'คืนบางส่วน', colorDot: 'bg-sky-500' },
  { value: 'returned', label: 'คืนครบแล้ว', colorDot: 'bg-teal-500' },
  { value: 'reversed', label: 'คืนสภาพแล้ว', colorDot: 'bg-purple-500' },
  { value: 'cancelled', label: 'ยกเลิกแล้ว', colorDot: 'bg-rose-500' },
]

const DISBURSEMENT_TYPE_OPTIONS: FilterOption[] = [
  { value: 'material_issue', label: 'เบิกจ่ายพัสดุ', colorDot: 'bg-sky-500' },
  { value: 'asset_handover', label: 'ส่งมอบครุภัณฑ์', colorDot: 'bg-indigo-500' },
  { value: 'asset_borrow', label: 'ยืมครุภัณฑ์', colorDot: 'bg-orange-500' },
]

interface DisbursementListClientProps {
  initialItems: DisbursementRow[]
  total: number
  currentPage: number
  pageSize: number
  totalPages: number
  currentQ: string
  currentStatus: string
  currentType: string
  canCreate: boolean
  stats?: {
    total: number
    active_borrow: number
    draft: number
    confirmed: number
  }
}

export function DisbursementListClient({
  initialItems,
  total,
  currentPage,
  pageSize,
  totalPages,
  currentQ,
  currentStatus,
  currentType,
  canCreate,
  stats,
}: DisbursementListClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(currentQ)
  const [status, setStatus] = useState(currentStatus)
  const [type, setType] = useState(currentType)

  const applyFilters = useCallback(
    (newQ = q, newStatus = status, newType = type, newPage = 1) => {
      const params = new URLSearchParams()
      if (newQ.trim()) params.set('q', newQ.trim())
      if (newStatus) params.set('status', newStatus)
      if (newType) params.set('type', newType)
      if (newPage > 1) params.set('page', String(newPage))

      startTransition(() => {
        const qs = params.toString()
        router.push(`/disbursements${qs ? `?${qs}` : ''}`)
      })
    },
    [q, status, type, router]
  )

  function handleSearchChange(val: string) {
    setQ(val)
    applyFilters(val, status, type, 1)
  }

  function handleSearchClear() {
    setQ('')
    applyFilters('', status, type, 1)
  }

  function handleClearAll() {
    setQ('')
    setStatus('')
    setType('')
    startTransition(() => {
      router.push('/disbursements')
    })
  }

  const startIdx = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIdx = Math.min(currentPage * pageSize, total)

  // Active filter chips list
  const activeChips = useMemo(() => {
    const chips: { id: string; label: string; value: string; onRemove: () => void }[] = []
    if (q.trim()) {
      chips.push({
        id: 'q',
        label: 'ค้นหา',
        value: `"${q.trim()}"`,
        onRemove: () => {
          setQ('')
          applyFilters('', status, type, 1)
        },
      })
    }
    if (type) {
      chips.push({
        id: 'type',
        label: 'ประเภท',
        value: DISBURSEMENT_TYPE_LABELS[type as keyof typeof DISBURSEMENT_TYPE_LABELS] || type,
        onRemove: () => {
          setType('')
          applyFilters(q, status, '', 1)
        },
      })
    }
    if (status) {
      chips.push({
        id: 'status',
        label: 'สถานะ',
        value: DISBURSEMENT_STATUS_LABELS[status as keyof typeof DISBURSEMENT_STATUS_LABELS] || status,
        onRemove: () => {
          setStatus('')
          applyFilters(q, '', type, 1)
        },
      })
    }
    return chips
  }, [q, status, type, applyFilters])

  const hasActiveFilters = Boolean(q || status || type)

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background text-foreground font-sans">
      <div className="flex min-h-0 flex-1 min-w-0 overflow-hidden">
        {/* Main Content Area */}
        <main className="flex flex-1 flex-col min-w-0 overflow-hidden bg-background">
          {/* ZONE 1: Page Header (Title + Summary Badge + Primary Action Button) */}
          <div className="shrink-0 border-b border-border bg-card px-4 py-3 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Left: Main Title & Count Badge */}
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-none truncate">
                  รายการทะเบียนเบิก-จ่ายพัสดุและครุภัณฑ์
                </h1>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20 shrink-0">
                  {total.toLocaleString()} รายการ
                </span>
              </div>

              {/* Right: Primary Action Button */}
              <div className="flex items-center gap-2 shrink-0">
                {canCreate && (
                  <Button
                    asChild
                    className="h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs px-3.5 gap-1.5 shadow-2xs transition-all cursor-pointer inline-flex items-center shrink-0"
                  >
                    <Link href="/disbursements/new">
                      <Plus className="h-4 w-4" />
                      <span>สร้างเอกสารเบิกจ่าย</span>
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ZONE 2: Filter Toolbar (Search + Dropdown Filters + Clear Button) */}
          <div className="shrink-0 border-b border-border bg-card/60 px-4 py-2.5 sm:px-6">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between min-w-0">
              {/* Left Side: Search + Dropdown Filters */}
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                {/* Search Input */}
                <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[200px] sm:max-w-xs min-w-0">
                  <SearchInput
                    value={q}
                    onChange={handleSearchChange}
                    onClear={handleSearchClear}
                    placeholder="ค้นหาเลขที่เอกสาร, ผู้รับ/ยืม, กลุ่มงาน, วัตถุประสงค์..."
                    className="w-full h-9 text-xs"
                  />
                </div>

                {/* Dropdown Filters */}
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  {/* Type Filter */}
                  <FilterDropdown
                    label="ประเภท"
                    ariaLabel="กรองตามประเภทรายการ"
                    name="type"
                    value={type}
                    options={DISBURSEMENT_TYPE_OPTIONS}
                    onChange={(val) => {
                      setType(val)
                      applyFilters(q, status, val, 1)
                    }}
                    icon={<Tag className="h-3.5 w-3.5" />}
                    allLabel="ทั้งหมด (ประเภท)"
                  />

                  {/* Status Filter */}
                  <FilterDropdown
                    label="สถานะ"
                    ariaLabel="กรองตามสถานะเอกสาร"
                    name="status"
                    value={status}
                    options={DISBURSEMENT_STATUS_OPTIONS}
                    onChange={(val) => {
                      setStatus(val)
                      applyFilters(q, val, type, 1)
                    }}
                    icon={<Activity className="h-3.5 w-3.5" />}
                    allLabel="ทั้งหมด (สถานะ)"
                  />

                  {/* Quick Reset Filters Button */}
                  {hasActiveFilters && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                      className="h-9 px-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-colors cursor-pointer shrink-0"
                      title="ล้างตัวกรองทั้งหมด"
                      aria-label="ล้างตัวกรอง"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">ล้างตัวกรอง</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Active Filter Chips */}
            {activeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60 mt-2">
                <span className="text-[11px] text-muted-foreground mr-1">ตัวกรองที่ใช้:</span>
                {activeChips.map((chip) => (
                  <span
                    key={chip.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[11px] border border-border"
                  >
                    <span className="text-muted-foreground">{chip.label}:</span>
                    <span className="font-semibold">{chip.value}</span>
                    <button
                      type="button"
                      onClick={chip.onRemove}
                      className="hover:text-destructive transition-colors ml-0.5 cursor-pointer"
                      aria-label={`ลบตัวกรอง ${chip.label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ZONE 3: Main Table Area with Transition Dimming */}
          <div className={cn('flex-1 min-h-0 overflow-auto bg-background transition-opacity duration-150', isPending && 'opacity-60 pointer-events-none')}>
            {initialItems.length === 0 ? (
              <div className="p-8 flex items-center justify-center min-h-[360px]">
                <EmptyState
                  icon={<Boxes className="h-10 w-10 text-muted-foreground/60" />}
                  title={hasActiveFilters ? 'ไม่พบเอกสารตามเงื่อนไขที่ค้นหา' : 'ยังไม่มีประวัติการเบิก-จ่าย'}
                  description={
                    hasActiveFilters
                      ? 'ลองปรับคำค้นหา หรือล้างตัวกรองเพื่อเรียกดูเอกสารทั้งหมด'
                      : 'เริ่มต้นบันทึกการเบิกจ่ายพัสดุสิ้นเปลือง ส่งมอบ หรือยืม-คืนครุภัณฑ์เพื่อติดตามสถานะ'
                  }
                  action={
                    hasActiveFilters ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleClearAll}
                        className="gap-1.5"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>ล้างตัวกรองทั้งหมด</span>
                      </Button>
                    ) : canCreate ? (
                      <Button asChild size="sm" className="gap-1.5">
                        <Link href="/disbursements/new">
                          <Plus className="h-4 w-4" />
                          <span>สร้างเอกสารเบิกจ่าย</span>
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <DataTable wrapperClassName="border-0 rounded-none shadow-none">
                <DataTableHeader>
                  <tr>
                    <DataTableHead className="w-[150px] font-bold text-muted-foreground uppercase text-xs py-3">เลขที่เอกสาร</DataTableHead>
                    <DataTableHead className="w-[140px] font-bold text-muted-foreground uppercase text-xs py-3">ประเภทรายการ</DataTableHead>
                    <DataTableHead className="min-w-[160px] font-bold text-muted-foreground uppercase text-xs py-3">ผู้รับ / ผู้ยืม</DataTableHead>
                    <DataTableHead className="min-w-[150px] font-bold text-muted-foreground uppercase text-xs py-3">กลุ่มงาน / สังกัด</DataTableHead>
                    <DataTableHead className="min-w-[180px] font-bold text-muted-foreground uppercase text-xs py-3">วัตถุประสงค์</DataTableHead>
                    <DataTableHead className="w-[130px] font-bold text-muted-foreground uppercase text-xs py-3">วันที่ทำรายการ</DataTableHead>
                    <DataTableHead className="w-[130px] font-bold text-muted-foreground uppercase text-xs py-3 text-center">สถานะ</DataTableHead>
                    <DataTableHead isActions className="w-[120px] font-bold text-muted-foreground uppercase text-xs py-3 text-right">การจัดการ</DataTableHead>
                  </tr>
                </DataTableHeader>
                <DataTableBody>
                  {initialItems.map((doc) => (
                    <DataTableRow key={doc.id} hoverable className="hover:bg-muted/40 transition-colors border-b border-border/40">
                      <DataTableCell className="font-mono font-medium text-foreground whitespace-nowrap">
                        <Link
                          href={`/disbursements/${doc.id}`}
                          className="hover:text-primary transition-colors hover:underline inline-flex items-center gap-1.5"
                        >
                          <span>{doc.document_no || 'ฉบับร่าง'}</span>
                        </Link>
                      </DataTableCell>
                      <DataTableCell>
                        <DisbursementTypeBadge type={doc.transaction_type} />
                      </DataTableCell>
                      <DataTableCell className="font-medium text-foreground">
                        {doc.recipient_name || <span className="text-muted-foreground/60">—</span>}
                      </DataTableCell>
                      <DataTableCell className="text-muted-foreground">
                        {doc.department_name || <span className="text-muted-foreground/60">—</span>}
                      </DataTableCell>
                      <DataTableCell className="text-muted-foreground max-w-xs truncate" title={doc.purpose || ''}>
                        {doc.purpose || <span className="text-muted-foreground/60">—</span>}
                      </DataTableCell>
                      <DataTableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                        {formatDate(doc.confirmed_at || doc.created_at)}
                      </DataTableCell>
                      <DataTableCell className="text-center">
                        <DisbursementStatusBadge status={doc.status} />
                      </DataTableCell>
                      <DataTableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-7 px-2 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 gap-1"
                        >
                          <Link href={`/disbursements/${doc.id}`}>
                            <span>ดูรายละเอียด</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </div>

          {/* ZONE 4: Sticky Footer with Server-Side Pagination Controls */}
          <footer className="flex min-h-12 flex-wrap gap-3 py-2.5 shrink-0 items-center justify-between border-t border-border bg-card px-4 text-xs text-muted-foreground shadow-inner z-10 min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
              <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-bold text-card-foreground shrink-0">
                {total > 0
                  ? `แสดง ${startIdx}–${endIdx} จาก ${total.toLocaleString()} รายการ`
                  : 'แสดง 0 จาก 0 รายการ'}
              </span>

              {stats?.active_borrow !== undefined && stats.active_borrow > 0 && (
                <span
                  title="เอกสารที่มีรายการกำลังยืม"
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0 select-none"
                >
                  <Clock className="h-3 w-3" />
                  <span>กำลังยืม: {stats.active_borrow}</span>
                </span>
              )}

              {stats?.draft !== undefined && stats.draft > 0 && (
                <span
                  title="เอกสารฉบับร่าง"
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-500/20 bg-slate-500/10 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0 select-none"
                >
                  <FileEdit className="h-3 w-3" />
                  <span>ฉบับร่าง: {stats.draft}</span>
                </span>
              )}

              {stats?.confirmed !== undefined && stats.confirmed > 0 && (
                <span
                  title="เอกสารที่ยืนยันแล้ว"
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 select-none"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>ยืนยันแล้ว: {stats.confirmed}</span>
                </span>
              )}
            </div>

            {/* Server-Side Pagination Controls matching items explorer */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isPending}
                onClick={() => applyFilters(q, status, type, currentPage - 1)}
                className="h-8 px-2.5 text-xs font-semibold"
                aria-label="หน้าก่อนหน้า"
              >
                ก่อนหน้า
              </Button>

              <div className="flex items-center gap-1">
                {getPageNumbers(currentPage, totalPages).map((item, idx) => {
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
                      onClick={() => applyFilters(q, status, type, item)}
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
                disabled={currentPage >= totalPages || isPending}
                onClick={() => applyFilters(q, status, type, currentPage + 1)}
                className="h-8 px-2.5 text-xs font-semibold"
                aria-label="หน้าถัดไป"
              >
                ถัดไป
              </Button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
