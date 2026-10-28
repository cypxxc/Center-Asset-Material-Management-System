'use client'

import { useState, useTransition, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Boxes,
  Plus,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Clock,
  FileEdit,
  CheckCircle2,
  X,
  FileText,
} from 'lucide-react'
import { formatDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { PageContainer } from '@/components/ui/page-container'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
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
    return chips
  }, [q, status, type, applyFilters])

  const hasActiveFilters = Boolean(q || status || type)

  return (
    <PageContainer maxWidth="7xl">
      {/* Page Header */}
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <Boxes className="h-6 w-6 text-primary shrink-0" aria-hidden="true" />
            <span>ทะเบียนเบิก-จ่ายพัสดุและครุภัณฑ์</span>
          </span>
        }
        subtitle="บันทึกการเบิกจ่ายพัสดุสิ้นเปลือง ส่งมอบ และยืม-คืนครุภัณฑ์ตามระเบียบพัสดุ"
        actions={
          canCreate ? (
            <Button asChild size="sm" className="gap-1.5 shadow-xs font-semibold">
              <Link href="/disbursements/new">
                <Plus className="h-4 w-4" />
                <span>สร้างเอกสารเบิกจ่าย</span>
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Operational Metric / Quick Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => {
            setStatus('')
            applyFilters(q, '', type, 1)
          }}
          className={cn(
            'p-3.5 rounded-xl border text-left transition-all cursor-pointer bg-card hover:bg-muted/40 shadow-xs flex items-center justify-between',
            !status ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-border'
          )}
        >
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium">เอกสารทั้งหมด</div>
            <div className="text-xl font-bold font-mono tracking-tight text-foreground">{total}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            const nextStatus = status === 'active_borrow' ? '' : 'active_borrow'
            setStatus(nextStatus)
            applyFilters(q, nextStatus, type, 1)
          }}
          className={cn(
            'p-3.5 rounded-xl border text-left transition-all cursor-pointer bg-card hover:bg-muted/40 shadow-xs flex items-center justify-between',
            status === 'active_borrow' ? 'border-amber-500 ring-1 ring-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20' : 'border-border'
          )}
        >
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium">กำลังยืม</div>
            <div className="text-xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400">
              {initialItems.filter((i) => i.status === 'active_borrow').length || (status === 'active_borrow' ? total : 0)}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="h-4 w-4" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            const nextStatus = status === 'draft' ? '' : 'draft'
            setStatus(nextStatus)
            applyFilters(q, nextStatus, type, 1)
          }}
          className={cn(
            'p-3.5 rounded-xl border text-left transition-all cursor-pointer bg-card hover:bg-muted/40 shadow-xs flex items-center justify-between',
            status === 'draft' ? 'border-slate-500 ring-1 ring-slate-500/20 bg-slate-50/50 dark:bg-slate-900/20' : 'border-border'
          )}
        >
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium">ฉบับร่าง</div>
            <div className="text-xl font-bold font-mono tracking-tight text-slate-700 dark:text-slate-300">
              {initialItems.filter((i) => i.status === 'draft').length || (status === 'draft' ? total : 0)}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
            <FileEdit className="h-4 w-4" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            const nextStatus = status === 'confirmed' ? '' : 'confirmed'
            setStatus(nextStatus)
            applyFilters(q, nextStatus, type, 1)
          }}
          className={cn(
            'p-3.5 rounded-xl border text-left transition-all cursor-pointer bg-card hover:bg-muted/40 shadow-xs flex items-center justify-between',
            status === 'confirmed' ? 'border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-border'
          )}
        >
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium">ยืนยันแล้ว</div>
            <div className="text-xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              {initialItems.filter((i) => i.status === 'confirmed').length || (status === 'confirmed' ? total : 0)}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Debounced SearchInput */}
          <div className="flex-1 min-w-[240px]">
            <SearchInput
              value={q}
              onChange={handleSearchChange}
              onClear={handleSearchClear}
              placeholder="ค้นหาเลขที่เอกสาร, ผู้รับ/ยืม, กลุ่มงาน, วัตถุประสงค์..."
              className="h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            {/* Status Filter Dropdown */}
            <select
              value={status}
              aria-label="กรองตามสถานะเอกสาร"
              onChange={(e) => {
                setStatus(e.target.value)
                applyFilters(q, e.target.value, type, 1)
              }}
              className="h-9 px-3 rounded-lg border border-input bg-background text-xs text-foreground font-medium hover:bg-accent/40 focus:outline-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer"
            >
              <option value="">ทุกสถานะเอกสาร</option>
              <option value="draft">ฉบับร่าง</option>
              <option value="confirmed">ยืนยันแล้ว</option>
              <option value="active_borrow">กำลังยืม</option>
              <option value="partially_returned">คืนบางส่วน</option>
              <option value="returned">คืนครบแล้ว</option>
              <option value="reversed">คืนสภาพแล้ว</option>
              <option value="cancelled">ยกเลิกแล้ว</option>
            </select>

            {/* Type Filter Dropdown */}
            <select
              value={type}
              aria-label="กรองตามประเภทรายการ"
              onChange={(e) => {
                setType(e.target.value)
                applyFilters(q, status, e.target.value, 1)
              }}
              className="h-9 px-3 rounded-lg border border-input bg-background text-xs text-foreground font-medium hover:bg-accent/40 focus:outline-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer"
            >
              <option value="">ทุกประเภทรายการ</option>
              <option value="material_issue">เบิกจ่ายพัสดุ</option>
              <option value="asset_handover">ส่งมอบครุภัณฑ์</option>
              <option value="asset_borrow">ยืมครุภัณฑ์</option>
            </select>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>ล้างตัวกรอง</span>
              </Button>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/60">
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

      {/* Main Table Area with Transition Dimming */}
      <div className={cn('transition-opacity duration-150', isPending && 'opacity-60 pointer-events-none')}>
        {initialItems.length === 0 ? (
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
        ) : (
          <div className="space-y-4">
            <DataTable wrapperClassName="shadow-xs border-border">
              <DataTableHeader>
                <tr>
                  <DataTableHead className="w-[140px]">เลขที่เอกสาร</DataTableHead>
                  <DataTableHead className="w-[130px]">ประเภทรายการ</DataTableHead>
                  <DataTableHead className="min-w-[150px]">ผู้รับ / ผู้ยืม</DataTableHead>
                  <DataTableHead className="min-w-[140px]">กลุ่มงาน / สังกัด</DataTableHead>
                  <DataTableHead className="min-w-[180px]">วัตถุประสงค์</DataTableHead>
                  <DataTableHead className="w-[130px]">วันที่ทำรายการ</DataTableHead>
                  <DataTableHead className="w-[130px] text-center">สถานะ</DataTableHead>
                  <DataTableHead isActions className="w-[110px]">การจัดการ</DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {initialItems.map((doc) => (
                  <DataTableRow key={doc.id} hoverable>
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
                <div>
                  แสดง{' '}
                  <span className="font-semibold text-foreground tabular-nums">
                    {startIdx} - {endIdx}
                  </span>{' '}
                  จากทั้งหมด{' '}
                  <span className="font-semibold text-foreground tabular-nums">{total}</span> รายการ
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1 || isPending}
                    onClick={() => applyFilters(q, status, type, currentPage - 1)}
                    className="h-8 px-2.5 text-xs font-medium gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>ก่อนหน้า</span>
                  </Button>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-muted/40 border border-border rounded-md tabular-nums">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages || isPending}
                    onClick={() => applyFilters(q, status, type, currentPage + 1)}
                    className="h-8 px-2.5 text-xs font-medium gap-1 cursor-pointer"
                  >
                    <span>ถัดไป</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  )
}
