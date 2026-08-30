'use client'

import React, { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  History,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Table as TableIcon,
  RefreshCw,
  Clock,
  Layers,
  ArrowRight,
  Code2,
} from 'lucide-react'
import { AuditLogListItem } from '@/features/admin/queries'
import { PageContainer } from '@/components/ui/page-container'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'
import {
  buildAuditDiff,
  getAuditActionLabel,
  getAuditTableLabel,
  formatJsonForDisplay,
} from '@/features/audit-log-display/format'

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

const ACTION_FILTER_OPTIONS = [
  { value: 'all', label: 'การทำรายการทั้งหมด' },
  { value: 'INSERT', label: 'สร้างข้อมูล (INSERT)' },
  { value: 'UPDATE', label: 'แก้ไขข้อมูล (UPDATE)' },
  { value: 'DELETE', label: 'ลบข้อมูล (DELETE)' },
  { value: 'EXPORT_REPORT', label: 'ส่งออกรายงาน (EXPORT)' },
  { value: 'create_user', label: 'สร้างผู้ใช้' },
  { value: 'update_user', label: 'แก้ไขผู้ใช้' },
  { value: 'delete_user', label: 'ลบผู้ใช้' },
  { value: 'sql_query', label: 'เรียกใช้ SQL' },
  { value: 'backup_restore', label: 'กู้คืนฐานข้อมูล' },
  { value: 'restore', label: 'กู้คืนพัสดุ' },
  { value: 'bulk_delete', label: 'ลบหลายรายการ' },
]

const TABLE_FILTER_OPTIONS = [
  { value: 'all', label: 'ทุกตารางข้อมูล' },
  { value: 'items', label: 'พัสดุครุภัณฑ์ (items)' },
  { value: 'categories', label: 'หมวดหมู่ (categories)' },
  { value: 'locations', label: 'สถานที่ (locations)' },
  { value: 'units', label: 'หน่วยนับ (units)' },
  { value: 'profiles', label: 'ผู้ใช้งาน (profiles)' },
  { value: 'audit_logs', label: 'ประวัติบันทึก (audit_logs)' },
]

function getActionBadge(action: string) {
  const upper = action.toUpperCase()
  const lower = action.toLowerCase()

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
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
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
      className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
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
      className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
      dotClass: 'bg-rose-500',
    }
  }

  if (
    upper.includes('EXPORT') ||
    lower.includes('export')
  ) {
    return {
      label: getAuditActionLabel(action),
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      dotClass: 'bg-amber-500',
    }
  }

  return {
    label: getAuditActionLabel(action),
    className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    dotClass: 'bg-purple-500',
  }
}

export default function AuditLogsClient({
  initialLogs,
  initialTotalCount,
  initialSearchParams,
}: AuditLogsClientProps) {
  useRealtimeRefresh(['audit_logs'])
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  // Filter States
  const [searchTerm, setSearchTerm] = useState(initialSearchParams.q)
  const [selectedAction, setSelectedAction] = useState(initialSearchParams.action)
  const [selectedTable, setSelectedTable] = useState(initialSearchParams.target_table)

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

  const applyFilters = (updates: {
    q?: string
    action?: string
    target_table?: string
    page?: number
    pageSize?: number
  }) => {
    const nextQ = updates.q !== undefined ? updates.q : searchTerm
    const nextAction = updates.action !== undefined ? updates.action : selectedAction
    const nextTable = updates.target_table !== undefined ? updates.target_table : selectedTable
    const nextPage = updates.page !== undefined ? updates.page : 1
    const nextPageSize = updates.pageSize !== undefined ? updates.pageSize : initialSearchParams.pageSize

    const params = new URLSearchParams()
    if (nextQ.trim()) params.set('q', nextQ.trim())
    if (nextAction && nextAction !== 'all') params.set('action', nextAction)
    if (nextTable && nextTable !== 'all') params.set('target_table', nextTable)
    if (nextPage > 1) params.set('page', nextPage.toString())
    if (nextPageSize !== 50) params.set('pageSize', nextPageSize.toString())

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    applyFilters({ q: searchTerm, page: 1 })
  }

  const handleResetFilters = () => {
    setSearchTerm('')
    setSelectedAction('all')
    setSelectedTable('all')
    startTransition(() => {
      router.push(pathname)
    })
  }

  // Pagination calculations
  const totalPages = Math.ceil(initialTotalCount / initialSearchParams.pageSize) || 1
  const currentPage = initialSearchParams.page
  const startItem = initialTotalCount === 0 ? 0 : (currentPage - 1) * initialSearchParams.pageSize + 1
  const endItem = Math.min(currentPage * initialSearchParams.pageSize, initialTotalCount)

  return (
    <PageContainer>
      <PageHeader
        title="ประวัติการทำรายการ (Audit Log Explorer)"
        subtitle="ตรวจสอบบันทึกความปลอดภัย การแก้ไขข้อมูล และกิจกรรมในระบบแบบละเอียดตามมาตรฐานการตรวจสอบ"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              startTransition(() => {
                router.refresh()
              })
            }}
            disabled={isPending}
            className="text-xs h-9 font-medium"
          >
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', isPending && 'animate-spin')} />
            รีเฟรช
          </Button>
        }
      />

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">บันทึกทั้งหมด</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {initialTotalCount.toLocaleString('th-TH')}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">หน้าปัจจุบัน</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {currentPage} <span className="text-sm font-normal text-slate-400">/ {totalPages}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">จำนวนแถวที่แสดง</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {initialLogs.length} <span className="text-sm font-normal text-slate-400">แถว</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
            <TableIcon className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-4 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาตาม Target ID, ชื่อตาราง, หรือประเภทรายการ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value)
                applyFilters({ action: e.target.value, page: 1 })
              }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ACTION_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={selectedTable}
              onChange={(e) => {
                setSelectedTable(e.target.value)
                applyFilters({ target_table: e.target.value, page: 1 })
              }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TABLE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <Button type="submit" size="sm" className="text-xs h-9 px-4">
              ค้นหา
            </Button>

            {(searchTerm || selectedAction !== 'all' || selectedTable !== 'all') && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs h-9 px-3 text-slate-600"
              >
                ล้างตัวกรอง
              </Button>
            )}
          </div>
        </form>

        {/* Quick Filter Action Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0 mr-1">ตัวกรองด่วน:</span>
          {['all', 'INSERT', 'UPDATE', 'DELETE', 'EXPORT_REPORT'].map((actionKey) => {
            const isSelected = selectedAction === actionKey
            const label =
              actionKey === 'all'
                ? 'ทั้งหมด'
                : actionKey === 'INSERT'
                ? 'INSERT (สร้าง)'
                : actionKey === 'UPDATE'
                ? 'UPDATE (แก้ไข)'
                : actionKey === 'DELETE'
                ? 'DELETE (ลบ)'
                : 'EXPORT (รายงาน)'

            return (
              <button
                key={actionKey}
                type="button"
                onClick={() => {
                  setSelectedAction(actionKey)
                  applyFilters({ action: actionKey, page: 1 })
                }}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0',
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4 min-w-[150px]">วัน-เวลา</th>
                <th className="py-3 px-4 min-w-[140px]">ประเภทรายการ</th>
                <th className="py-3 px-4 min-w-[130px]">ตารางเป้าหมาย</th>
                <th className="py-3 px-4 min-w-[150px]">รหัสเป้าหมาย (Target ID)</th>
                <th className="py-3 px-4 min-w-[180px]">ผู้ทำรายการ</th>
                <th className="py-3 px-4 min-w-[150px]">การเปลี่ยนแปลง</th>
                <th className="py-3 px-4 w-20 text-right">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {initialLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <History className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-semibold">ไม่พบบันทึกประวัติการทำรายการ</p>
                    <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองรายการด้านบน</p>
                  </td>
                </tr>
              ) : (
                initialLogs.map((log, index) => {
                  const isExpanded = !!expandedRows[log.id]
                  const badge = getActionBadge(log.action)
                  const tableLabel = getAuditTableLabel(log.target_table)
                  const diff = buildAuditDiff(log.old_data, log.new_data)
                  const formattedDate = new Date(log.created_at).toLocaleString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => toggleRow(log.id)}
                        className={cn(
                          'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors',
                          isExpanded && 'bg-blue-50/30 dark:bg-blue-950/20'
                        )}
                      >
                        <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400">
                          {startItem + index}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{formattedDate}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border',
                              badge.className
                            )}
                          >
                            <span className={cn('w-1.5 h-1.5 rounded-full', badge.dotClass)} />
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {tableLabel}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">{log.target_table}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.target_id ? (
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[130px]" title={log.target_id}>
                                {log.target_id}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCopy(log.target_id!, `target-${log.id}`)
                                }}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-700"
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
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-[10px]">
                              {log.actor_name?.charAt(0) || 'U'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                                {log.actor_name || 'ระบบอัตโนมัติ'}
                              </div>
                              {log.actor_email && (
                                <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                  {log.actor_email}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {diff.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {diff.length} ฟิลด์เปลี่ยนแปลง
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {log.new_data ? 'ข้อมูล JSON' : 'ไม่มีรายละเอียด'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleRow(log.id)
                            }}
                            className={cn(
                              'p-1.5 rounded-lg border transition-all inline-flex items-center justify-center',
                              isExpanded
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                            )}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Row Content */}
                      {isExpanded && (
                        <tr className="bg-slate-50/60 dark:bg-slate-950/40">
                          <td colSpan={8} className="p-4 sm:p-6 border-y border-slate-200 dark:border-slate-800">
                            <div className="space-y-4 max-w-5xl">
                              {/* Summary Header */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                  <Code2 className="w-4 h-4 text-blue-600" />
                                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                                    การเปลี่ยนแปลงข้อมูล (Diff Inspector)
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                                  <span>Log ID: {log.id}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(log.id, `logid-${log.id}`)}
                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
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
                                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                                  <div className="bg-slate-100/70 dark:bg-slate-950 px-4 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                                    รายการฟิลด์ที่ตรวจพบการเปลี่ยนแปลง ({diff.length} ฟิลด์)
                                  </div>
                                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {diff.map((entry) => (
                                      <div
                                        key={entry.key}
                                        className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto_1fr] items-center gap-3 p-3.5 text-xs"
                                      >
                                        <div>
                                          <div className="font-bold text-slate-800 dark:text-slate-200">{entry.label}</div>
                                          <div className="font-mono text-[10px] text-slate-400">{entry.key}</div>
                                        </div>
                                        <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg p-2.5">
                                          <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mb-1">ค่าเดิม (Old)</div>
                                          <div className="text-slate-800 dark:text-slate-200 font-mono text-[11px] break-words">
                                            {entry.oldValue || 'ไม่มีข้อมูล'}
                                          </div>
                                        </div>
                                        <div className="hidden md:flex justify-center text-slate-400">
                                          <ArrowRight className="w-4 h-4" />
                                        </div>
                                        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg p-2.5">
                                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">ค่าใหม่ (New)</div>
                                          <div className="text-slate-800 dark:text-slate-200 font-mono text-[11px] break-words">
                                            {entry.newValue || 'ไม่มีข้อมูล'}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs text-slate-500">
                                  {log.old_data || log.new_data
                                    ? 'ไม่พบฟิลด์ที่มีการเปลี่ยนแปลงโดยตรง (ข้อมูลเหตุการณ์แบบก้อนเดียว หรือไม่มีค่าเดิม)'
                                    : 'ไม่มีข้อมูลรายละเอียด JSON สำหรับรายการนี้'}
                                </div>
                              )}

                              {/* Raw JSON Accordion */}
                              <details className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                <summary className="cursor-pointer px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between select-none">
                                  <span>ดูโครงสร้างข้อมูลดิบ (Raw JSON Payloads)</span>
                                  <span className="text-[11px] font-normal text-slate-400">คลิกเพื่อดู</span>
                                </summary>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">old_data</span>
                                      {log.old_data && (
                                        <button
                                          type="button"
                                          onClick={() => handleCopy(formatJsonForDisplay(log.old_data), `raw-old-${log.id}`)}
                                          className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
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
                                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">new_data</span>
                                      {log.new_data && (
                                        <button
                                          type="button"
                                          onClick={() => handleCopy(formatJsonForDisplay(log.new_data), `raw-new-${log.id}`)}
                                          className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
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
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs">
          <div className="text-slate-500 font-medium">
            แสดง <span className="font-bold text-slate-700 dark:text-slate-300">{startItem}</span> ถึง{' '}
            <span className="font-bold text-slate-700 dark:text-slate-300">{endItem}</span> จากทั้งหมด{' '}
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {initialTotalCount.toLocaleString('th-TH')}
            </span>{' '}
            รายการ
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyFilters({ page: currentPage - 1 })}
              disabled={currentPage <= 1 || isPending}
              className="text-xs h-8 px-2.5"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              ก่อนหน้า
            </Button>

            <span className="text-xs font-semibold px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
              {currentPage} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => applyFilters({ page: currentPage + 1 })}
              disabled={currentPage >= totalPages || isPending}
              className="text-xs h-8 px-2.5"
            >
              ถัดไป
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
