'use client'

import React, { useState } from 'react'
import {
 History,
 ChevronDown,
 ChevronUp,
 Copy,
 Check,
 Table as TableIcon,
 Clock,
 ArrowRight,
 Code2,
} from 'lucide-react'
import type { AuditLogListItem } from '@/features/admin/types'
import { useAuditLogsFilter } from '@/features/admin/hooks/use-audit-logs-filter'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import {
 DataTable,
 DataTableHeader,
 DataTableHead,
 DataTableBody,
 DataTableRow,
 DataTableCell,
} from '@/components/ui/data-table'
import { cn } from '@/lib/utils'
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'
import {
 buildAuditDiff,
 getAuditActionLabel,
 getAuditTableLabel,
 formatJsonForDisplay,
} from '@/features/audit-log-display/format'
import { formatDateTime } from '@/lib/date'
import { FilterDropdown, type FilterOption } from '@/components/ui/filter-dropdown'
import { AuditActionFilter } from '@/features/admin/components/audit-action-filter'
import { getPageNumbers } from '@/features/disbursements/pagination'

interface AuditLogsClientProps {
 currentUserId?: string
 initialLogs: AuditLogListItem[]
 initialTotalCount: number
 initialSearchParams: {
 q: string
 action: string
 target_table: string
 page: number
 pageSize: number
 }
}

const TABLE_DROPDOWN_OPTIONS: FilterOption[] = [
 { value: 'disbursements', label: 'เอกสารเบิก–ยืม (disbursements)' },
 { value: 'disbursement_items', label: 'รายการวัสดุเบิก–ยืม (disbursement_items)' },
 { value: 'items', label: 'วัสดุครุภัณฑ์ (items)' },
 { value: 'categories', label: 'หมวดหมู่ (categories)' },
 { value: 'locations', label: 'สถานที่ (locations)' },
 { value: 'units', label: 'หน่วยนับ (units)' },
 { value: 'profiles', label: 'ผู้ใช้งาน (profiles)' },
 { value: 'audit_logs', label: 'ประวัติบันทึก (audit_logs)' },
]

function getActionBadge(action: string) {
 const upper = action.toUpperCase()
 const lower = action.toLowerCase()

 if (['CONFIRM_DISBURSEMENT', 'REJECT_BORROW_REQUEST', 'CANCEL_DISBURSEMENT_DRAFT', 'WITHDRAW_DISBURSEMENT_REQUEST', 'REVERSE_DISBURSEMENT', 'RETURN_DISBURSEMENT_ITEM'].includes(upper)) {
 return {
 label: getAuditActionLabel(action),
 className: 'bg-violet-500/10 text-violet-700 border-violet-500/20',
 dotClass: 'bg-violet-500',
 }
 }

 if (
 upper === 'INSERT' ||
 lower === 'create' ||
 lower === 'create_user' ||
 lower === 'create_table_row' ||
 lower === 'restore' ||
 upper === 'RESTORE'
 ) {
 return {
 label: getAuditActionLabel(action),
 className: 'bg-emerald-50 text-emerald-700 border-emerald-200 ',
 dotClass: 'bg-emerald-500',
 }
 }

 if (
 upper === 'UPDATE' ||
 lower === 'update' ||
 lower === 'update_user' ||
 lower === 'update_table_row' ||
 lower === 'update_role_status' ||
 lower === 'reset_password'
 ) {
 return {
 label: getAuditActionLabel(action),
 className: 'bg-blue-50 text-blue-700 border-blue-200 ',
 dotClass: 'bg-blue-500',
 }
 }

 if (
 upper === 'DELETE' ||
 lower === 'delete' ||
 lower === 'delete_user' ||
 lower === 'delete_table_row' ||
 lower === 'hard_delete' ||
 lower === 'bulk_delete'
 ) {
 return {
 label: getAuditActionLabel(action),
 className: 'bg-rose-50 text-rose-700 border-rose-200 ',
 dotClass: 'bg-rose-500',
 }
 }

 if (
 upper.includes('EXPORT') ||
 lower.includes('export')
 ) {
 return {
 label: getAuditActionLabel(action),
 className: 'bg-amber-50 text-amber-700 border-amber-200 ',
 dotClass: 'bg-amber-500',
 }
 }

 return {
 label: getAuditActionLabel(action),
 className: 'bg-purple-50 text-purple-700 border-purple-200 ',
 dotClass: 'bg-purple-500',
 }
}

export default function AuditLogsClient({
 initialLogs,
 initialTotalCount,
 initialSearchParams,
}: AuditLogsClientProps) {
 useRealtimeRefresh(['audit_logs'], {
 pauseOnHidden: true,
 debounceDelay: 300,
 maxWait: 1500,
 })
 const {
 searchTerm,
 setSearchTerm,
 selectedAction,
 setSelectedAction,
 selectedTable,
 setSelectedTable,
 isPending,
 applyFilters,
 } = useAuditLogsFilter(initialSearchParams)

 // Expanded row IDs
 const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

 // Copied state tracking
 const [copiedId, setCopiedId] = useState<string | null>(null)

 const handleCopy = (text: string, id: string) => {
 navigator.clipboard.writeText(text)
 setCopiedId(id)
 setTimeout(() => setCopiedId(null), 2000)
 }

 const toggleRow = (id: string) => {
 setExpandedRows((prev) => ({
 ...prev,
 [id]: !prev[id],
 }))
 }

 // Pagination calculations
 const totalPages = Math.ceil(initialTotalCount / initialSearchParams.pageSize) || 1
 const currentPage = initialSearchParams.page
 const startItem = initialTotalCount === 0 ? 0 : (currentPage - 1) * initialSearchParams.pageSize + 1
 const endItem = Math.min(currentPage * initialSearchParams.pageSize, initialTotalCount)

 return (
 <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
 <div className="flex h-14 shrink-0 items-center border-b border-border px-4 sm:px-6">
 <PageHeader
 title="Logs"
 />
 </div>
 <div className="max-h-[60%] shrink-0 space-y-4 overflow-y-auto border-b border-border p-4 sm:px-6">

 {/* Filter and Search Bar */}
 <div className="space-y-3">
 <div className="flex flex-col md:flex-row gap-3">
 <div className="flex flex-1 [&>div]:max-w-none">
 <SearchInput
 aria-label="ค้นหาประวัติการทำรายการ"
 placeholder="ค้นหาตาม Target ID, ชื่อตาราง, หรือประเภทรายการ..."
 value={searchTerm}
 onChange={(value) => {
 setSearchTerm(value)
 applyFilters({ q: value, page: 1 })
 }}
 isLoading={isPending}
 debounceMs={300}
 className="h-9 text-xs"
 />
 </div>

 <div className="flex flex-wrap sm:flex-nowrap gap-2">
 <AuditActionFilter value={selectedAction} onChange={(val) => {
 const next = val || 'all'
 setSelectedAction(next)
 applyFilters({ action: next, page: 1 })
 }} />

 <FilterDropdown
 label="ตารางข้อมูล"
 ariaLabel="กรองตามตารางข้อมูล"
 name="target_table"
 value={selectedTable === 'all' ? '' : selectedTable}
 options={TABLE_DROPDOWN_OPTIONS}
 onChange={(val) => {
 const next = val || 'all'
 setSelectedTable(next)
 applyFilters({ target_table: next, page: 1 })
 }}
 icon={<TableIcon className="w-3.5 h-3.5" />}
 allLabel="ทุกตารางข้อมูล"
 />

 </div>
 </div>

 </div>
 </div>
 {/* Main Table */}
 <section aria-label="รายการบันทึกประวัติ" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
 <DataTable
 responsive={true}
 wrapperClassName="min-h-0 flex-1 overflow-auto rounded-none border-0 bg-muted/10 shadow-none"
 className="table-fixed min-w-[1420px] text-card-foreground"
 >
 <caption className="sr-only">ประวัติการทำรายการในระบบ</caption>
 <colgroup>
 <col style={{ width: 48 }} />
 <col style={{ width: 180 }} />
 <col style={{ width: 160 }} />
 <col style={{ width: 160 }} />
 <col style={{ width: 300 }} />
 <col style={{ width: 260 }} />
 <col style={{ width: 200 }} />
 <col style={{ width: 112 }} />
 </colgroup>
 <DataTableHeader className="bg-muted/75 backdrop-blur-xs border-b border-border/80 sticky top-0 z-10 [&_th]:px-2.5 [&_th]:text-xs">
 <tr>
 <DataTableHead className="w-12 text-center">ลำดับ</DataTableHead>
 <DataTableHead className="min-w-[150px]">วัน-เวลา</DataTableHead>
 <DataTableHead className="min-w-[140px]">ประเภทรายการ</DataTableHead>
 <DataTableHead className="min-w-[130px]">ตารางเป้าหมาย</DataTableHead>
 <DataTableHead className="min-w-[150px]">รหัสเป้าหมาย (Target ID)</DataTableHead>
 <DataTableHead className="min-w-[180px]">ผู้ทำรายการ</DataTableHead>
 <DataTableHead className="min-w-[150px]">การเปลี่ยนแปลง</DataTableHead>
 <DataTableHead isActions className="w-20">รายละเอียด</DataTableHead>
 </tr>
 </DataTableHeader>
 <DataTableBody>
 {initialLogs.length === 0 ? (
 <tr>
 <td colSpan={8} className="py-12 text-center text-muted-foreground">
 <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-60" />
 <p className="text-sm font-semibold text-foreground">ไม่พบบันทึกประวัติการทำรายการ</p>
 <p className="text-xs text-muted-foreground mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองรายการด้านบน</p>
 </td>
 </tr>
 ) : (
 initialLogs.map((log, index) => {
 const isExpanded = !!expandedRows[log.id]
 const badge = getActionBadge(log.action)
 const tableLabel = getAuditTableLabel(log.target_table)
 const diff = buildAuditDiff(log.old_data, log.new_data)
 const formattedDate = formatDateTime(log.created_at)

 return (
 <React.Fragment key={log.id}>
 <DataTableRow
 tabIndex={0}
 onClick={() => toggleRow(log.id)}
 onKeyDown={(event) => {
 if (event.target === event.currentTarget && event.key === 'Enter') toggleRow(log.id)
 }}
 className={cn(
 'group h-[42px] cursor-pointer transition-colors outline-none focus-visible:bg-muted/70 focus-visible:ring-1 focus-visible:ring-primary/50 [&>td]:h-[42px] [&>td]:px-2.5 [&>td]:py-0 [&>td]:text-xs',
 isExpanded
 ? 'border-b border-primary/40 bg-primary/10 text-card-foreground shadow-2xs'
 : 'border-b border-border/40 text-card-foreground hover:bg-muted/40'
 )}
 >
 <DataTableCell className="text-center font-mono text-[11px] text-muted-foreground">
 {startItem + index}
 </DataTableCell>
 <DataTableCell className="whitespace-nowrap">
 <div className="flex items-center gap-1.5 font-medium text-foreground">
 <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 <span>{formattedDate}</span>
 </div>
 </DataTableCell>
 <DataTableCell className="min-w-0">
 <span
 className={cn(
 'inline-flex max-w-full items-start gap-1.5 whitespace-normal break-words px-2 py-0.5 rounded-md text-[11px] font-semibold border',
 badge.className
 )}
 >
 <span className={cn('mt-1 w-1.5 h-1.5 shrink-0 rounded-full', badge.dotClass)} />
 <span className="min-w-0">{badge.label}</span>
 </span>
 </DataTableCell>
 <DataTableCell className="whitespace-nowrap">
 <div className="font-semibold text-foreground">
 {tableLabel}
 </div>
 <div className="text-[10px] font-mono text-muted-foreground">{log.target_table}</div>
 </DataTableCell>
 <DataTableCell className="whitespace-nowrap">
 {log.target_id ? (
 <div className="flex items-center gap-1">
 <span className="font-mono text-[11px] text-muted-foreground break-all whitespace-normal" title={log.target_id}>
 {log.target_id}
 </span>
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation()
 handleCopy(log.target_id!, `target-${log.id}`)
 }}
 className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground cursor-pointer"
 title="คัดลอกรหัส"
 >
 {copiedId === `target-${log.id}` ? (
 <Check className="w-3 h-3 text-emerald-600" />
 ) : (
 <Copy className="w-3 h-3" />
 )}
 </button>
 </div>
 ) : (
 <span className="text-muted-foreground text-[11px]">-</span>
 )}
 </DataTableCell>
 <DataTableCell className="whitespace-nowrap">
 <div className="font-normal text-foreground whitespace-normal break-words">
 {log.actor_name || 'ระบบอัตโนมัติ'}
 </div>
 </DataTableCell>
 <DataTableCell className="whitespace-nowrap">
 {diff.length > 0 ? (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-muted text-foreground">
 {diff.length} ฟิลด์เปลี่ยนแปลง
 </span>
 ) : (
 <span className="text-[11px] text-muted-foreground">
 {log.new_data ? 'ข้อมูล JSON' : 'ไม่มีรายละเอียด'}
 </span>
 )}
 </DataTableCell>
 <DataTableCell isActions className="whitespace-nowrap">
 <button
 type="button"
 aria-label={isExpanded ? 'ซ่อนรายละเอียดรายการ' : 'ดูรายละเอียดรายการ'}
 aria-expanded={isExpanded}
 onClick={(e) => {
 e.stopPropagation()
 toggleRow(log.id)
 }}
 className={cn(
 'p-1.5 rounded-lg border transition-all inline-flex items-center justify-center cursor-pointer',
 isExpanded
 ? 'bg-primary text-primary-foreground border-primary shadow-xs'
 : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted'
 )}
 >
 {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
 </button>
 </DataTableCell>
 </DataTableRow>

 {/* Expanded Row Content */}
 {isExpanded && (
 <tr className="bg-muted/30">
 <td colSpan={8} className="p-4 sm:p-6 border-y border-border">
 <div className="space-y-4 max-w-5xl">
 {/* Summary Header */}
 <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
 <div className="flex items-center gap-2">
 <Code2 className="w-4 h-4 text-primary" />
 <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
 การเปลี่ยนแปลงข้อมูล (Diff Inspector)
 </h4>
 </div>
 <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
 <span>Log ID: {log.id}</span>
 <button
 type="button"
 onClick={() => handleCopy(log.id, `logid-${log.id}`)}
 className="p-1 hover:bg-muted rounded cursor-pointer"
 >
 {copiedId === `logid-${log.id}` ? (
 <Check className="w-3 h-3 text-emerald-600" />
 ) : (
 <Copy className="w-3 h-3" />
 )}
 </button>
 </div>
 </div>

 {/* Visual Field Diff Grid */}
 {diff.length > 0 ? (
 <div className="rounded-lg border border-border bg-card overflow-hidden">
 <div className="bg-muted/70 px-4 py-2 text-[11px] font-bold text-foreground border-b border-border">
 รายการฟิลด์ที่ตรวจพบการเปลี่ยนแปลง ({diff.length} ฟิลด์)
 </div>
 <div className="divide-y divide-border">
 {diff.map((entry) => (
 <div
 key={entry.key}
 className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto_1fr] items-center gap-3 p-3.5 text-xs"
 >
 <div>
 <div className="font-bold text-foreground">{entry.label}</div>
 <div className="font-mono text-[10px] text-muted-foreground">{entry.key}</div>
 </div>
 <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
 <div className="text-[10px] font-bold text-destructive mb-1">ค่าเดิม (Old)</div>
 <div className="text-foreground font-mono text-[11px] break-words">
 {entry.oldValue || 'ไม่มีข้อมูล'}
 </div>
 </div>
 <div className="hidden md:flex justify-center text-muted-foreground">
 <ArrowRight className="w-4 h-4" />
 </div>
 <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5">
 <div className="text-[10px] font-bold text-emerald-600 mb-1">ค่าใหม่ (New)</div>
 <div className="text-foreground font-mono text-[11px] break-words">
 {entry.newValue || 'ไม่มีข้อมูล'}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 ) : (
 <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
 {log.old_data || log.new_data
 ? 'ไม่พบฟิลด์ที่มีการเปลี่ยนแปลงโดยตรง (ข้อมูลเหตุการณ์แบบก้อนเดียว หรือไม่มีค่าเดิม)'
 : 'ไม่มีข้อมูลรายละเอียด JSON สำหรับรายการนี้'}
 </div>
 )}

 {/* Raw JSON Accordion */}
 <details className="rounded-lg border border-border bg-card">
 <summary className="cursor-pointer px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted/50 flex items-center justify-between select-none">
 <span>ดูโครงสร้างข้อมูลดิบ (Raw JSON Payloads)</span>
 <span className="text-[11px] font-normal text-muted-foreground">คลิกเพื่อดู</span>
 </summary>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border-t border-border bg-muted/20">
 <div>
 <div className="flex items-center justify-between mb-1.5">
 <span className="text-[11px] font-bold text-muted-foreground">old_data</span>
 {log.old_data && (
 <button
 type="button"
 onClick={() => handleCopy(formatJsonForDisplay(log.old_data), `raw-old-${log.id}`)}
 className="text-[10px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
 >
 {copiedId === `raw-old-${log.id}` ? 'คัดลอกแล้ว' : 'คัดลอก JSON'}
 </button>
 )}
 </div>
 <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-[11px] font-mono max-h-64 overflow-auto border border-slate-800">
 {formatJsonForDisplay(log.old_data)}
 </pre>
 </div>
 <div>
 <div className="flex items-center justify-between mb-1.5">
 <span className="text-[11px] font-bold text-muted-foreground">new_data</span>
 {log.new_data && (
 <button
 type="button"
 onClick={() => handleCopy(formatJsonForDisplay(log.new_data), `raw-new-${log.id}`)}
 className="text-[10px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
 >
 {copiedId === `raw-new-${log.id}` ? 'คัดลอกแล้ว' : 'คัดลอก JSON'}
 </button>
 )}
 </div>
 <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg text-[11px] font-mono max-h-64 overflow-auto border border-slate-800">
 {formatJsonForDisplay(log.new_data)}
 </pre>
 </div>
 </div>
 </details>
 </div>
 </td>
 </tr>
 )}
 </React.Fragment>
 )
 })
 )}
 </DataTableBody>
 </DataTable>

 {/* Pagination Footer */}
 <footer className="flex min-h-12 flex-wrap gap-3 py-2.5 shrink-0 items-center justify-between border-t border-border bg-card px-4 text-xs text-muted-foreground shadow-inner z-10 min-w-0">
 <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-bold text-card-foreground shrink-0" aria-live="polite">
 {initialTotalCount > 0
 ? `แสดง ${startItem}–${endItem} จาก ${initialTotalCount.toLocaleString()} รายการ`
 : 'แสดง 0 จาก 0 รายการ'}
 </span>

 <nav aria-label="การแบ่งหน้าประวัติการทำรายการ" className="flex max-w-full flex-wrap items-center gap-1.5 sm:gap-2">
 <Button
 variant="outline"
 size="sm"
 onClick={() => applyFilters({ page: currentPage - 1 })}
 disabled={currentPage <= 1 || isPending}
 className="h-8 px-2.5 text-xs font-semibold"
 aria-label="หน้าก่อนหน้า"
 >
 ก่อนหน้า
 </Button>

 <div className="flex items-center gap-1">
 {getPageNumbers(currentPage, totalPages).map((page, index) => page === 'ellipsis' ? (
 <span key={`ellipsis-${index}`} className="px-1 text-muted-foreground" aria-hidden="true">…</span>
 ) : (
 <button
 key={page}
 type="button"
 disabled={isPending}
 onClick={() => applyFilters({ page })}
 aria-current={page === currentPage ? 'page' : undefined}
 aria-label={`หน้า ${page}`}
 className={cn(
 'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring',
 page === currentPage
 ? 'bg-primary text-primary-foreground shadow-xs font-bold'
 : 'text-muted-foreground hover:bg-muted hover:text-foreground'
 )}
 >
 {page}
 </button>
 ))}
 </div>

 <Button
 variant="outline"
 size="sm"
 onClick={() => applyFilters({ page: currentPage + 1 })}
 disabled={currentPage >= totalPages || isPending}
 className="h-8 px-2.5 text-xs font-semibold"
 aria-label="หน้าถัดไป"
 >
 ถัดไป
 </Button>
 </nav>
 </footer>
 </section>
 </div>
 )
}

