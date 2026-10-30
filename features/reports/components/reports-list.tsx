'use client'

import { useTransition, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Download, Printer, FileText, AlertTriangle, CheckCircle, Loader2, Filter, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/ui/page-container'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS } from '@/features/items/types'
import type { ReportItemRow, ReportStats } from '../types'
import { recordReportExportAudit, getExportReportItems } from '../actions'
import { generateReportPdf } from '../pdf-generator'
import { formatDate } from '@/lib/date'
import { SearchInput } from '@/components/ui/search-input'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { RealtimeRefreshBridge } from '@/components/realtime-refresh-bridge'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'
import { CategoryComboChartSkeleton } from '@/features/reports/components/category-combo-chart'

const CategoryComboChart = dynamic(
  () => import('@/features/reports/components/category-combo-chart').then((mod) => mod.CategoryComboChart),
  {
    ssr: false,
    loading: () => <CategoryComboChartSkeleton />,
  }
)
import {
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableCell
} from '@/components/ui/data-table'

interface ReportsListProps {
  preparedBy?: string
  items: ReportItemRow[]
  totalCount: number
  totalQuantity: number
  totalValue: number
  totalPages: number
  currentPage: number
  searchParams: {
    q?: string
    type?: string
    status?: string
    category_id?: string
    location_id?: string
    sort_by?: string
    sort_dir?: string
    page?: string
  }
  categories: { id: string; name: string }[]
  locations: { id: string; name: string }[]
  stats?: ReportStats
  view?: 'all' | 'header-and-kpis' | 'table-and-filters'
  userCanExport?: boolean
}

export function ReportsList({
  preparedBy,
  items,
  totalCount,
  totalQuantity,
  totalValue,
  totalPages,
  currentPage,
  searchParams,
  categories,
  locations,
  stats,
  view = 'all',
  userCanExport = false,
}: ReportsListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [searchVal, setSearchVal] = useState(searchParams.q ?? '')
  const [prevQ, setPrevQ] = useState(searchParams.q ?? '')
  const [isExportingExcel, setIsExportingExcel] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  const currentQ = searchParams.q ?? ''
  if (currentQ !== prevQ) {
    setPrevQ(currentQ)
    setSearchVal(currentQ)
  }

  const hasActiveFilters = Boolean(
    searchParams.q ||
    searchParams.category_id ||
    searchParams.location_id ||
    searchParams.type ||
    searchParams.status
  )

  const buildFilterSummary = () => {
    const parts: string[] = []
    if (searchParams.q) parts.push(`ค้นหา: "${searchParams.q}"`)
    if (searchParams.category_id) {
      const cat = categories.find((c) => c.id === searchParams.category_id)
      if (cat) parts.push(`หมวดหมู่: ${cat.name}`)
    }
    if (searchParams.location_id) {
      const loc = locations.find((l) => l.id === searchParams.location_id)
      if (loc) parts.push(`สถานที่: ${loc.name}`)
    }
    if (searchParams.type) {
      const typeLabel = ITEM_TYPE_LABELS[searchParams.type as keyof typeof ITEM_TYPE_LABELS] || searchParams.type
      parts.push(`ประเภท: ${typeLabel}`)
    }
    if (searchParams.status) {
      const statusLabel = ITEM_STATUS_LABELS[searchParams.status as keyof typeof ITEM_STATUS_LABELS] || searchParams.status
      parts.push(`สถานะ: ${statusLabel}`)
    }
    return parts.length > 0 ? parts.join(', ') : 'ทั้งหมด'
  }

  const handleFilterChange = (updates: {
    q?: string
    type?: string
    status?: string
    category_id?: string
    location_id?: string
    page?: string
  }) => {
    const query = new URLSearchParams()
    
    const newQ = updates.q !== undefined ? updates.q : searchVal
    const newType = updates.type !== undefined ? updates.type : (searchParams.type ?? '')
    const newStatus = updates.status !== undefined ? updates.status : (searchParams.status ?? '')
    const newCategory = updates.category_id !== undefined ? updates.category_id : (searchParams.category_id ?? '')
    const newLocation = updates.location_id !== undefined ? updates.location_id : (searchParams.location_id ?? '')
    const newPage = updates.page !== undefined ? updates.page : '1'
    
    if (newQ) query.set('q', newQ)
    if (newType) query.set('type', newType)
    if (newStatus) query.set('status', newStatus)
    if (newCategory) query.set('category_id', newCategory)
    if (newLocation) query.set('location_id', newLocation)
    if (newPage && newPage !== '1') query.set('page', newPage)
    
    startTransition(() => {
      router.push(`${pathname}?${query.toString()}`)
    })
  }

  const exportToExcel = async () => {
    setIsExportingExcel(true)
    try {
      const filterSummary = buildFilterSummary()
      const { items: exportItems, totalQuantity: exportQty, totalValue: exportVal } =
        await getExportReportItems(searchParams)

      const { generateReportExcel } = await import('../excel-generator')
      const buffer = await generateReportExcel(exportItems, {
        filterSummary,
        totalQuantity: exportQty,
        totalValue: exportVal,
      })

      const blob = new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `office-items-report-${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)

      await recordReportExportAudit('excel', filterSummary)
    } catch (error) {
      console.error('Failed to export Excel:', error)
    } finally {
      setIsExportingExcel(false)
    }
  }

  const exportToPdf = async () => {
    setIsExportingPdf(true)
    try {
      const filterSummary = buildFilterSummary()
      const { items: exportItems, totalQuantity: exportQty, totalValue: exportVal } =
        await getExportReportItems(searchParams)

      generateReportPdf(exportItems, filterSummary, exportQty, exportVal)

      await recordReportExportAudit('pdf', filterSummary)
    } catch (error) {
      console.error('Failed to export PDF:', error)
    } finally {
      setIsExportingPdf(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const categoryComboData = (() => {
    if (stats?.categoryCounts && Object.keys(stats.categoryCounts).length > 0) {
      return Object.entries(stats.categoryCounts).map(([category, countData]) => {
        // activeQty comes pre-aggregated from stats (or defaults to countData.qty if unavailable)
        const resolvedActiveQty = typeof countData.activeQty === 'number'
          ? Math.min(countData.activeQty, countData.qty)
          : countData.qty

        return {
          category,
          totalQty: countData.qty,
          activeQty: resolvedActiveQty,
        }
      })
    }

    // Fallback computed from items if stats.categoryCounts is empty
    const categoryMap = new Map<string, { totalQty: number; activeQty: number }>()
    for (const item of items) {
      const catName = item.category?.name || 'ทั่วไป'
      const current = categoryMap.get(catName) || { totalQty: 0, activeQty: 0 }
      current.totalQty += item.quantity || 0
      if (item.status === 'active') {
        current.activeQty += item.quantity || 0
      }
      categoryMap.set(catName, current)
    }

    return Array.from(categoryMap.entries()).map(([category, { totalQty, activeQty }]) => ({
      category,
      totalQty,
      activeQty,
    }))
  })()

  const activeCount = stats?.statusCounts?.active?.count ?? items.filter((i) => i.status === 'active').length
  const overdueAuditItems = items.filter(
    (item) => item.status === 'damaged' || item.status === 'waiting_repair'
  )

  const renderHeader = view === 'all' || view === 'header-and-kpis'
  const renderTable = view === 'all' || view === 'table-and-filters'

  return (
    <>
      {renderHeader && <RealtimeRefreshBridge tables={['items', 'categories', 'locations', 'units']} />}
    <PageContainer maxWidth="full" className={cn('h-auto overflow-visible print:bg-white print:p-0', !renderHeader && 'pt-0', !renderTable && 'pb-0')}>
      
      {renderHeader && (
        <>
          {/* Printable Report Header */}
          <div className="hidden print:block p-8 border-b-2 border-border print:border-slate-900 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-foreground print:text-slate-900">รายงานทะเบียนพัสดุ</h1>
                <p className="text-xs text-muted-foreground print:text-slate-500" suppressHydrationWarning>วันที่พิมพ์รายงาน: {formatDate()}{preparedBy ? ` | จัดเตรียมโดย: ${preparedBy}` : ''}</p>
                <p className="mt-2 text-xs text-foreground">
                  เงื่อนไข: {[
                    searchParams.q && `คำค้น: ${searchParams.q}`,
                    searchParams.type && `ประเภท: ${ITEM_TYPE_LABELS[searchParams.type as keyof typeof ITEM_TYPE_LABELS] || searchParams.type}`,
                    searchParams.status && `สถานะ: ${ITEM_STATUS_LABELS[searchParams.status as keyof typeof ITEM_STATUS_LABELS] || searchParams.status}`,
                    searchParams.category_id && `หมวดหมู่: ${categories.find((category) => category.id === searchParams.category_id)?.name || searchParams.category_id}`,
                    searchParams.location_id && `สถานที่: ${locations.find((location) => location.id === searchParams.location_id)?.name || searchParams.location_id}`,
                  ].filter(Boolean).join(' · ') || 'ทั้งหมด'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">หน้าที่ {currentPage} จาก {Math.max(1, totalPages)} · แสดง {items.length} จาก {totalCount} รายการที่ตรงเงื่อนไข</p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold text-primary print:text-blue-600">CAMMS Portal</h2>
                <p className="text-xs text-muted-foreground print:text-slate-500">
                  Center Asset & Material Management System
                </p>
              </div>
            </div>
          </div>

          {/* Regular UI Header */}
          <PageHeader
            title={
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-bold tracking-tight">รายงานพัสดุ</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ระบบเรียลไทม์
                  </span>
                </div>
              </div>
            }
            subtitle="สรุปมูลค่าทรัพย์สิน วิเคราะห์อัตราความพร้อมใช้งาน และส่งออกรายงานมาตรฐานสากล"
            className="print:hidden"
            actions={
              <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                {userCanExport && (
                  <Button
                    onClick={exportToExcel}
                    aria-label="ดาวน์โหลดรายงาน Excel"
                    className="px-3.5 py-2 bg-background hover:bg-muted text-foreground text-xs font-semibold rounded-lg border border-border/80 flex items-center gap-2 transition-all shadow-2xs h-9 cursor-pointer"
                    variant="outline"
                    disabled={(renderTable ? items.length === 0 : totalCount === 0) || isExportingExcel}
                  >
                    {isExportingExcel ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span>ดาวน์โหลด Excel</span>
                  </Button>
                )}
                <Button
                  onClick={exportToPdf}
                  aria-label="ส่งออกรายงาน PDF"
                  className="px-3.5 py-2 bg-background hover:bg-muted text-foreground text-xs font-semibold rounded-lg border border-border/80 flex items-center gap-2 transition-all shadow-2xs h-9 cursor-pointer"
                  variant="outline"
                  disabled={(renderTable ? items.length === 0 : totalCount === 0) || isExportingPdf}
                >
                  {isExportingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span>ส่งออก PDF</span>
                </Button>
                <Button
                  onClick={handlePrint}
                  aria-label="พิมพ์รายงาน"
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs h-9 cursor-pointer"
                  disabled={renderTable ? items.length === 0 : totalCount === 0}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>พิมพ์รายงาน (Print)</span>
                </Button>
              </div>
            }
          />

          {/* Category Combo Chart with Consolidated KPIs */}
          <div className="min-h-[480px]">
            <CategoryComboChart
              data={categoryComboData}
              totalValue={totalValue || stats?.totalValue}
              totalCount={totalCount || (stats?.totalItems ?? 0)}
              activeCount={activeCount}
            />
          </div>
        </>
      )}

      {renderTable && (
        <>

        {/* Command Filter Bar */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs print:hidden space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-card-foreground">ตัวกรองและค้นหารายการพัสดุ</span>
              {hasActiveFilters && (
                <span className="text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  มีตัวกรองที่เลือก
                </span>
              )}
            </div>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchVal('')
                  handleFilterChange({ q: '', type: '', status: '', category_id: '', location_id: '', page: '1' })
                }}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>ล้างตัวกรองทั้งหมด</span>
              </Button>
            )}
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault()
              handleFilterChange({ q: searchVal })
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-center"
          >
            <div className="sm:col-span-2 lg:col-span-2">
              <SearchInput
                value={searchVal}
                onChange={(val) => {
                  setSearchVal(val)
                  handleFilterChange({ q: val.trim() })
                }}
                onClear={() => handleFilterChange({ q: '' })}
                placeholder="ค้นหาด้วยชื่อ, เลขครุภัณฑ์, Serial..."
                className="w-full h-9"
              />
            </div>

            <select 
              name="category_id" 
              value={searchParams.category_id ?? ''} 
              onChange={(e) => handleFilterChange({ category_id: e.target.value, page: '1' })}
              className="h-9 rounded-lg border border-border/80 bg-background px-3 text-xs font-medium text-foreground hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs transition-colors"
            >
              <option value="">ทุกหมวดหมู่</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              name="location_id"
              value={searchParams.location_id ?? ''}
              onChange={(e) => handleFilterChange({ location_id: e.target.value, page: '1' })}
              className="h-9 rounded-lg border border-border/80 bg-background px-3 text-xs font-medium text-foreground hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs transition-colors"
            >
              <option value="">ทุกสถานที่ตั้ง</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>

            <select 
              name="type" 
              value={searchParams.type ?? ''} 
              onChange={(e) => handleFilterChange({ type: e.target.value, page: '1' })}
              className="h-9 rounded-lg border border-border/80 bg-background px-3 text-xs font-medium text-foreground hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs transition-colors"
            >
              <option value="">ทุกประเภท</option>
              {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <select 
              name="status" 
              value={searchParams.status ?? ''} 
              onChange={(e) => handleFilterChange({ status: e.target.value, page: '1' })}
              className="h-9 rounded-lg border border-border/80 bg-background px-3 text-xs font-medium text-foreground hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs transition-colors"
            >
              <option value="">ทุกสถานะ</option>
              {Object.entries(ITEM_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </form>
        </div>

        {/* Overdue Audits / Maintenance Alert */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-2xs print:hidden space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-card-foreground text-sm flex items-center gap-2">
                  <span>รายการครุภัณฑ์ที่พบชำรุดหรือต้องการตรวจสอบสภาพ (Audit & Repair Alerts)</span>
                  {overdueAuditItems.length > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      {overdueAuditItems.length} รายการ
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  รายการอุปกรณ์ที่ได้รับการแจ้งชำรุด (Damaged) หรือรอการประสานงานซ่อมบำรุงในทะเบียนระบบงานปัจจุบัน
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {overdueAuditItems.map((item) => (
              <div key={item.id} className="p-3 bg-muted/20 hover:bg-muted/40 border border-border/60 rounded-xl flex items-center justify-between text-xs transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                    !
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-card-foreground truncate">{item.item_name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      S/N: {item.serial_no || '-'} <span className="text-border">|</span> สถานที่: {item.location?.name || '-'}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    {ITEM_STATUS_LABELS[item.status as keyof typeof ITEM_STATUS_LABELS]}
                  </span>
                </div>
              </div>
            ))}

            {overdueAuditItems.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-2">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-foreground">ครุภัณฑ์ทุกชิ้นอยู่ในสภาพพร้อมใช้งานและไม่มีรายการชำรุดค้างระบบ</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">ระบบตรวจสอบสถานะทะเบียนทรัพย์สินอัตโนมัติ</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Asset Ledger Table */}
        <div className="relative bg-card rounded-2xl border border-border/80 shadow-2xs overflow-hidden print:shadow-none print:border-none flex flex-col">
          {isPending && <LoadingOverlay />}
          <div className={`flex-1 min-h-0 flex flex-col transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
            
            {/* Table Header Bar */}
            <div className="p-4 sm:p-5 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <h3 className="font-semibold text-card-foreground text-sm">
                  รายงานราคาและทรัพย์สินรายตัว (Asset Ledger Valuation)
                </h3>
                <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">
                  {totalCount.toLocaleString('th-TH')} รายการ
                </span>
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                มูลค่ารวมหน้านี้: <span className="font-mono font-bold text-foreground">{totalValue.toLocaleString('th-TH')} บาท</span>
              </div>
            </div>
            
            <DataTable>
              <DataTableHeader>
                <tr className="border-b border-border/80 bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <DataTableHead className="py-3 px-4">ชื่อครุภัณฑ์ / หมายเลข</DataTableHead>
                  <DataTableHead className="py-3 px-4">หมวดหมู่</DataTableHead>
                  <DataTableHead className="py-3 px-4 text-center">จำนวน</DataTableHead>
                  <DataTableHead className="py-3 px-4 text-right">ราคาต่อหน่วย</DataTableHead>
                  <DataTableHead className="py-3 px-4 text-right">ราคารวม</DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {items.map((item) => {
                  const unitPrice = item.unit_price ?? 0
                  const totalPrice = unitPrice * item.quantity
                  return (
                    <DataTableRow key={item.id} className="h-13 hover:bg-muted/30 transition-colors border-b border-border/40 print:hover:bg-transparent">
                      <DataTableCell className="py-3 px-4">
                        <div className="font-semibold text-xs text-card-foreground print:text-black">{item.item_name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/40">
                            S/N: {item.serial_no || item.asset_no || '-'}
                          </span>
                        </div>
                      </DataTableCell>
                      <DataTableCell className="py-3 px-4 text-xs text-muted-foreground">{item.category?.name || 'ทั่วไป'}</DataTableCell>
                      <DataTableCell className="py-3 px-4 text-center font-mono font-semibold text-xs text-card-foreground">{item.quantity} {item.unit?.name ?? ''}</DataTableCell>
                      <DataTableCell className="py-3 px-4 text-right font-mono text-xs tabular-nums text-muted-foreground">{unitPrice.toLocaleString('th-TH')} บาท</DataTableCell>
                      <DataTableCell className="py-3 px-4 text-right font-mono font-bold text-xs tabular-nums text-card-foreground print:text-black">
                        {totalPrice.toLocaleString('th-TH')} บาท
                      </DataTableCell>
                    </DataTableRow>
                  )
                })}

                {items.length === 0 && (
                  <DataTableRow>
                    <DataTableCell colSpan={5} className="py-12">
                      <EmptyState
                        title="ไม่พบข้อมูลรายงานสิ่งของตามข้อกำหนด"
                        description="ลองปรับเปลี่ยนตัวเลือกหรือคำค้นหาด้านบน"
                        className="border-0 shadow-none bg-transparent min-h-0 py-6"
                      />
                    </DataTableCell>
                  </DataTableRow>
                )}
              </DataTableBody>
              {items.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border/80 bg-muted/30 font-semibold">
                    <td colSpan={2} className="py-3.5 px-4 text-card-foreground text-right font-bold text-xs sm:text-sm">มูลค่ารวมทั้งสิ้น:</td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-xs sm:text-sm text-card-foreground">{totalQuantity} ชิ้น</td>
                    <td colSpan={2} className="py-3.5 px-4 text-right font-mono font-extrabold text-sm sm:text-base text-primary">{totalValue.toLocaleString('th-TH')} บาท</td>
                  </tr>
                </tfoot>
              )}
            </DataTable>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/80 px-4 sm:px-6 py-3.5 bg-muted/10 print:hidden">
                <div className="text-xs text-muted-foreground font-medium">
                  แสดงหน้า {currentPage} จากทั้งหมด {totalPages} หน้า (ทั้งหมด {totalCount} รายการ)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => handleFilterChange({ page: String(currentPage - 1) })}
                    className="h-8 px-3 rounded-lg text-xs font-semibold border border-border/80 bg-background text-card-foreground hover:bg-muted cursor-pointer shadow-2xs transition-colors"
                  >
                    ก่อนหน้า
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => handleFilterChange({ page: String(currentPage + 1) })}
                    className="h-8 px-3 rounded-lg text-xs font-semibold border border-border/80 bg-background text-card-foreground hover:bg-muted cursor-pointer shadow-2xs transition-colors"
                  >
                    ถัดไป
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        </>
      )}

    </PageContainer>
    </>
  )
}

