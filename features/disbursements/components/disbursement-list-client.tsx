'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { DropdownMenu } from 'radix-ui'
import {
 Activity,
 Boxes,
 Plus,
 RotateCcw,
 Clock,
 FileEdit,
 CheckCircle2,
 ChevronDown,
 Check,
} from 'lucide-react'
import { AuditActionFilter } from '@/features/admin/components/audit-action-filter'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { FilterDropdown, type FilterOption } from '@/components/ui/filter-dropdown'
import { EmptyState } from '@/components/ui/empty-state'
import { GroupedTransactionsTable } from './grouped-transactions-table'
import type { DisbursementRow, CentralAvailableItem } from '@/features/disbursements/types'
import { BorrowCatalogView } from '@/features/disbursements/components/borrow-catalog-view'
import { getPageNumbers } from '../pagination'

export { getPageNumbers } from '../pagination'

const DisbursementCreateModal = dynamic(() => import('./disbursement-create-modal').then((module) => module.DisbursementCreateModal))
const CustodyHistoryPanel = dynamic(() => import('./custody-history-panel').then((module) => module.CustodyHistoryPanel))

const DISBURSEMENT_STATUS_OPTIONS: FilterOption[] = [
  { value: 'pending_approval', label: 'รออนุมัติ', colorDot: 'bg-amber-500' },
  { value: 'active_borrow', label: 'อนุมัติแล้ว / กำลังยืม', colorDot: 'bg-amber-500' },
  { value: 'rejected', label: 'ไม่อนุมัติ', colorDot: 'bg-rose-500' },
]

const HISTORY_STATUS_OPTIONS: FilterOption[] = [
 { value: 'confirmed', label: 'เบิกอนุมัติแล้ว' },
 { value: 'cancelled', label: 'ยกเลิกแล้ว' },
 { value: 'reversed', label: 'คืนสภาพแล้ว' },
 { value: 'returned', label: 'คืนครบแล้ว' },
 { value: 'rejected', label: 'ไม่อนุมัติ' },
]

interface DisbursementListClientProps {
 materialApprovalSlaHours?: number | null
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
 pending_approval?: number
 }
 centralItems?: CentralAvailableItem[]
 userRole?: string
 initialTab?: 'catalog' | 'documents' | 'requests' | 'history'
}

export function DisbursementListClient({
 materialApprovalSlaHours = null,
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
 centralItems = [],
 userRole = 'user',
 initialTab,
}: DisbursementListClientProps) {
 const router = useRouter()
 const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
 const [custodyRevision, setCustodyRevision] = useState(0)
 const [isPending, startTransition] = useTransition()
 const [activeTab, setActiveTab] = useState<'catalog' | 'documents' | 'requests' | 'history'>(
 initialTab || 'catalog'
 )
 const [q, setQ] = useState(currentQ)
 const [catalogQuery, setCatalogQuery] = useState('')
 const [catalogType, setCatalogType] = useState<'asset' | 'material'>('asset')
 const catalogItems = centralItems.filter(item => item.item_type === catalogType)
 const [cartContainer, setCartContainer] = useState<HTMLDivElement | null>(null)
 const [status, setStatus] = useState(currentStatus)
 const [type, setType] = useState(currentType)
 const navigationState = JSON.stringify([initialTab, currentQ, currentStatus, currentType])
 const [previousNavigation, setPreviousNavigation] = useState(navigationState)
 if (previousNavigation !== navigationState) {
 setPreviousNavigation(navigationState)
 setActiveTab(initialTab || 'catalog')
 setQ(currentQ)
 setStatus(currentStatus)
 setType(currentType)
 }

 const applyFilters = useCallback(
 (newQ = q, newStatus = status, newType = type, newPage = 1, newTab: 'documents' | 'requests' | 'history' = activeTab === 'history' ? 'history' : activeTab === 'requests' ? 'requests' : 'documents') => {
 const params = new URLSearchParams()
 params.set('tab', newTab)
 if (newTab === 'history') params.set('action', 'approval_history')
 if (newQ.trim()) params.set('q', newQ.trim())
 params.set('status', newStatus || 'all')
 if (newType) params.set('type', newType)
 if (newPage > 1) params.set('page', String(newPage))
 startTransition(() => {
 router.replace(`${activeTab === 'history' ? '/admin/audit-logs' : '/disbursements'}?${params}`, { scroll: false })
 })
 },
 [q, status, type, router, activeTab]
 )

 function handleSearchChange(val: string) {
 setQ(val)
 if (userRole === 'admin' && activeTab === 'documents') return
 applyFilters(val, status, type, 1)
 }

 function handleSearchClear() {
 setQ('')
 if (userRole === 'admin' && activeTab === 'documents') return
 applyFilters('', status, type, 1)
 }

 function handleClearAll() {
 setQ('')
 setStatus('all')
 setType('')
 applyFilters('', 'all', '', 1)
 }

 const startIdx = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
 const endIdx = Math.min(currentPage * pageSize, total)

 const hasActiveFilters = Boolean(q || (status && status !== 'all') || type)

 return (
 <div className="relative flex h-full flex-col overflow-hidden bg-background text-foreground font-sans">
 <div className="flex min-h-0 flex-1 min-w-0 overflow-hidden">
 {/* Main Content Area */}
 <main className="flex flex-1 flex-col min-w-0 overflow-hidden bg-background">
 {/* ZONE 1: Page Header (Title + Summary Badge + Primary Action Button) */}
 <div className="shrink-0 border-b border-border bg-card px-4 sm:px-6 h-14 flex items-center">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
 {/* Left: Main Title & Count Badge */}
 <div className="flex items-center gap-3 min-w-0">
 <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-none truncate">
 {activeTab === 'history' ? 'ประวัติการอนุมัติ' : userRole === 'user' ? 'เบิก' : 'เบิก - จ่าย'}
 </h1>
 <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20 shrink-0">
 {activeTab === 'catalog'
 ? `${catalogItems.length} รายการ${catalogType === 'material' ? 'พร้อมเบิก' : 'พร้อมเบิก/ยืม'}`
 : userRole === 'admin' && activeTab === 'documents' ? 'ผู้ถือครอง' : `${total.toLocaleString()} รายการเอกสาร`}
 </span>
 </div>

 {/* Right: Primary Action Button */}
 <div className="flex items-center gap-2 shrink-0">
 {canCreate && userRole === 'admin' && activeTab === 'documents' && (
 <Button
 onClick={() => setIsCreateModalOpen(true)}
 className="h-8 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/15 text-primary font-normal text-xs px-3.5 gap-1.5 transition-colors cursor-pointer inline-flex items-center shrink-0"
 >
 <Plus className="h-4 w-4" />
 <span>สั่งจ่าย</span>
 </Button>
 )}
 {canCreate && userRole === 'user' && activeTab === 'documents' && (
 <Button asChild className="h-8 border border-primary/30 bg-primary/10 text-primary font-normal hover:bg-primary/15">
 <Link href="/disbursements/new">ส่งคำขอเบิก</Link>
 </Button>
 )}
 </div>
 </div>
 </div>

 {/* Top Tab Switcher */}
 <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-1.5 sm:px-6">
 {activeTab !== 'history' && <>
 <div className="flex shrink-0 gap-1 rounded-lg bg-muted p-0.5" role="group" aria-label="เบิกและยืม">
 <DropdownMenu.Root>
 <DropdownMenu.Trigger asChild>
 <button
 type="button"
 aria-current={activeTab === 'catalog' ? 'page' : undefined}
 className={cn(
 'group inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none',
 activeTab === 'catalog'
 ? 'bg-background text-primary shadow-xs'
 : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
 )}
 >
 <span>เบิก / ยืม</span>
 <ChevronDown className="ml-0.5 h-3.5 w-3.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100" aria-hidden="true" />
 </button>
 </DropdownMenu.Trigger>
 <DropdownMenu.Portal>
 <DropdownMenu.Content align="start" sideOffset={6} className="z-50 min-w-[200px] max-w-[280px] max-h-[320px] overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none">
 <DropdownMenu.RadioGroup value={catalogType} onValueChange={value => {
   setCatalogType(value as 'asset' | 'material')
   setCatalogQuery('')
   setActiveTab('catalog')
   router.push('/disbursements?tab=catalog', { scroll: false })
 }}>
 {([{ value: 'asset', label: 'ครุภัณฑ์' }, { value: 'material', label: 'วัสดุ' }] as const).map(option => <DropdownMenu.RadioItem key={option.value} value={option.value} className={cn('flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none transition-colors', catalogType === option.value ? 'bg-primary/10 text-primary font-bold' : 'text-foreground hover:bg-muted data-[highlighted]:bg-muted')}>
 <span className="truncate">{option.label}</span>
 <DropdownMenu.ItemIndicator><Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /></DropdownMenu.ItemIndicator>
 </DropdownMenu.RadioItem>)}
 </DropdownMenu.RadioGroup>
 </DropdownMenu.Content>
 </DropdownMenu.Portal>
 </DropdownMenu.Root>

 </div>
 <div className="ml-1 flex shrink-0 gap-1 rounded-lg bg-muted p-0.5" role="group" aria-label="จ่ายและอนุมัติ">
 <button
 type="button"
 onClick={() => { setActiveTab('documents'); applyFilters('', 'all', '', 1, 'documents') }}
 aria-pressed={activeTab === 'documents'}
 className={cn(
 'min-h-9 flex-1 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none',
 activeTab === 'documents'
 ? 'bg-background text-primary shadow-xs'
 : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
 )}
 >
 {userRole === 'admin' ? 'จ่าย' : 'รายการของฉัน'}
 </button>
 {userRole === 'admin' && (
 <>
 <button
 type="button"
 onClick={() => {
 setActiveTab('requests')
 setStatus('all')
 setType('')
 setQ('')
 applyFilters('', 'all', '', 1, 'requests')
 }}
 aria-pressed={activeTab === 'requests'}
 className={cn(
 'min-h-9 flex-1 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none',
 activeTab === 'requests' ? 'bg-background text-primary shadow-xs' : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
 )}
 >
 อนุมัติ
 </button>
 </>
 )}
 </div>
 </>}
 <div className="order-2 min-w-0 flex-1 basis-[calc(100%-8rem)] sm:order-1 sm:basis-0 sm:max-w-md sm:mx-auto">
 <SearchInput
 key={activeTab}
 value={activeTab === 'catalog' ? catalogQuery : q}
 onChange={activeTab === 'catalog' ? setCatalogQuery : handleSearchChange}
 onClear={activeTab === 'catalog' ? () => setCatalogQuery('') : handleSearchClear}
 debounceMs={activeTab === 'catalog' ? 300 : 500}
 placeholder={activeTab === 'catalog' ? catalogType === 'material' ? 'ค้นหาชื่อวัสดุ, สถานที่จัดเก็บ...' : 'ค้นหาชื่อ, หมายเลขครุภัณฑ์, ยี่ห้อ, รุ่น, สถานที่...' : userRole === 'admin' && activeTab === 'documents' ? 'ค้นหาสิ่งของ, ผู้ถือครอง, ผู้ทำรายการ...' : 'ค้นหาเลขที่เอกสาร, ผู้รับ/ยืม, กลุ่มงาน...'}
 aria-label={activeTab === 'catalog' ? catalogType === 'material' ? 'ค้นหาวัสดุ' : 'ค้นหาครุภัณฑ์' : userRole === 'admin' && activeTab === 'documents' ? 'ค้นหาประวัติผู้ถือครอง' : 'ค้นหาเอกสารเบิกจ่าย'}
 className="h-9 text-xs"
 />
 </div>
 {activeTab === 'catalog' && <div ref={setCartContainer} className="order-3 shrink-0 sm:order-2" />}
 {activeTab !== 'catalog' && (userRole !== 'admin' || activeTab === 'requests' || activeTab === 'history') && (
 <div className="order-3 min-w-0">
 {/* Dropdown Filters */}
 <div className="flex flex-wrap items-center gap-2 min-w-0">
 {activeTab === 'history' && <AuditActionFilter value="approval_history" />}
 {/* Status Filter */}
 {activeTab !== 'requests' && <FilterDropdown
 label="สถานะ"
 ariaLabel="กรองตามสถานะเอกสาร"
 name="status"
 value={status === 'all' ? '' : status}
 options={activeTab === 'history' ? HISTORY_STATUS_OPTIONS : DISBURSEMENT_STATUS_OPTIONS}
 onChange={(val) => {
 setStatus(val || 'all')
 applyFilters(q, val || 'all', type, 1)
 }}
 icon={<Activity className="h-3.5 w-3.5" />}
 allLabel="ทั้งหมด (สถานะ)"
 />}

 {activeTab !== 'requests' && activeTab !== 'history' && <Button type="button" variant="ghost" size="sm" onClick={() => { setQ(''); setStatus('all'); setType(''); applyFilters('', 'all', '', 1) }}>ดูประวัติทั้งหมด</Button>}

 {/* Quick Reset Filters Button */}
 {hasActiveFilters && activeTab !== 'history' && (
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
 )}
 </div>

 {activeTab === 'catalog' ? (
 <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
 <BorrowCatalogView
 catalogType={catalogType}
 cartContainer={cartContainer}
 items={centralItems}
 searchQuery={catalogQuery}
 onSwitchToDocs={() => router.refresh()}
 onSuccess={() => router.refresh()}
 />
 </div>
 ) : userRole === 'admin' && activeTab === 'documents' ? (
 <CustodyHistoryPanel query={q} revision={custodyRevision} />
 ) : (
 <>
 {/* ZONE 3: Main Table Area with Transition Dimming */}
 <div className={cn('flex-1 min-h-0 overflow-auto bg-background transition-opacity duration-150', isPending && 'opacity-60 pointer-events-none')}>
 {initialItems.length === 0 ? (
 activeTab === 'requests' || activeTab === 'history' ? (
 <p role="status" className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
 {hasActiveFilters ? 'ไม่พบรายการตามเงื่อนไขที่ค้นหา' : activeTab === 'history' ? 'ยังไม่มีประวัติการอนุมัติ' : 'ไม่มีคำขอรออนุมัติ'}
 </p>
 ) : (
 <div className="p-8 flex items-center justify-center min-h-[360px]">
 <EmptyState
 icon={<Boxes className="h-10 w-10 text-muted-foreground/60" />}
 title={hasActiveFilters ? 'ไม่พบเอกสารตามเงื่อนไขที่ค้นหา' : 'ยังไม่มีประวัติการเบิก-จ่าย'}
 description={
 hasActiveFilters
 ? 'ลองปรับคำค้นหา หรือล้างตัวกรองเพื่อเรียกดูเอกสารทั้งหมด'
 : 'เริ่มต้นบันทึกการเบิกจ่ายวัสดุสิ้นเปลือง ส่งมอบ หรือยืม-คืนครุภัณฑ์เพื่อติดตามสถานะ'
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
 <Button asChild size="sm" className="gap-1.5 border border-primary/30 bg-primary/10 text-primary font-normal hover:bg-primary/15">
 <Link href="/disbursements/new">
 <Plus className="h-4 w-4" />
 <span>ส่งคำขอเบิก</span>
 </Link>
 </Button>
 ) : undefined
 }
 />
 </div>
 )
 ) : (
 <GroupedTransactionsTable documents={initialItems} userRole={userRole} historyMode={activeTab === 'history'} materialApprovalSlaHours={materialApprovalSlaHours} />
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

 {activeTab !== 'history' && stats?.active_borrow !== undefined && stats.active_borrow > 0 && (
 <span
 title="เอกสารที่มีรายการกำลังยืม"
 className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 shrink-0 select-none"
 >
 <Clock className="h-3 w-3" />
 <span>กำลังยืม: {stats.active_borrow}</span>
 </span>
 )}

 {activeTab !== 'history' && stats?.draft !== undefined && stats.draft > 0 && (
 <span
 title="เอกสารฉบับร่าง"
 className="inline-flex items-center gap-1.5 rounded-md border border-slate-500/20 bg-slate-500/10 px-2.5 py-1 text-xs font-semibold text-slate-600 shrink-0 select-none"
 >
 <FileEdit className="h-3 w-3" />
 <span>ฉบับร่าง: {stats.draft}</span>
 </span>
 )}

 {activeTab !== 'history' && stats?.confirmed !== undefined && stats.confirmed > 0 && (
 <span
 title="เอกสารที่ยืนยันแล้ว"
 className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 shrink-0 select-none"
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
 'flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring',
 isCurrent
 ? 'border-primary/40 bg-primary/10 text-primary shadow-xs font-bold'
 : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
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
 </>
 )}
 {isCreateModalOpen && canCreate && userRole === 'admin' && (
 <DisbursementCreateModal onClose={() => setIsCreateModalOpen(false)} onSuccess={() => { setIsCreateModalOpen(false); setCustodyRevision((value) => value + 1); router.refresh() }} />
 )}
 </main>
 </div>
 </div>
 )
}
