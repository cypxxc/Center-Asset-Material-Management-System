'use client'

import { useTransition, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Download, Printer, FileText, AlertTriangle, CheckCircle, Award, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/ui/page-container'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS } from '@/features/items/types'
import { ReportItemRow } from '../queries'
import { recordReportExportAudit, getExportReportItems } from '../actions'
import { generateReportPdf } from '@/lib/reports-pdf-generator'
import { formatDate } from '@/lib/date'
import { SearchInput } from '@/components/ui/search-input'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import {
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableCell
} from '@/components/ui/data-table'

interface ReportsListProps {
  items: ReportItemRow[]
  totalCount: number
  totalQuantity: number
  totalValue: number
  totalPages: number
  currentPage: number
  auditedCount: number
  overdueAuditItems: ReportItemRow[]
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
  stats: {
    totalItems: number
    totalQuantity: number
    typeCounts: Record<string, { count: number; qty: number }>
    statusCounts: Record<string, { count: number; qty: number }>
    categoryCounts: Record<string, { count: number; qty: number }>
    locationCount: number
  }
}

export function ReportsList({
  items,
  totalCount,
  totalQuantity,
  totalValue,
  totalPages,
  currentPage,
  auditedCount,
  overdueAuditItems,
  searchParams,
  categories,
  locations
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

      const { generateReportExcel } = await import('@/lib/reports-excel-generator')
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

  const auditProgressPct = totalCount > 0 ? Math.round((auditedCount / totalCount) * 100) : 100

  return (
    <PageContainer className="print:bg-white print:p-0">
      
      {/* Printable Report Header */}
      <div className="hidden print:block p-8 border-b-2 border-border print:border-slate-900 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-foreground print:text-slate-900">รายงานครุภัณฑ์สํานักงานประจําปี</h1>
            <p className="text-xs text-muted-foreground print:text-slate-500 mt-1">สำนักงานใหญ่ แผนกเทคโนโลยีสารสนเทศและบริหารจัดการทั่วไป</p>
            <p className="text-xs text-muted-foreground print:text-slate-500" suppressHydrationWarning>วันที่พิมพ์รายงาน: {formatDate()} | จัดเตรียมโดย: เจ้าหน้าที่พัสดุ</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-primary print:text-blue-600">CAMMS</h2>
            <p className="text-xs text-muted-foreground print:text-slate-500">
              Center Asset Material Management System — ทะเบียนสิ่งของและครุภัณฑ์ส่วนกลาง
            </p>
          </div>
        </div>
      </div>

      {/* Regular UI Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span>รายงานสรุปและวิเคราะห์ผล (Inventory Reports)</span>
          </div>
        }
        subtitle="สรุปมูลค่าครุภัณฑ์ ตรวจสอบสถานะ และส่งออกข้อมูลเป็นไฟล์ Excel/CSV"
        className="print:hidden"
        actions={
          <>
            <Button
              onClick={exportToExcel}
              aria-label="ดาวน์โหลดรายงาน Excel"
              className="px-3.5 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-2xs h-9 cursor-pointer"
              variant="outline"
              disabled={items.length === 0 || isExportingExcel}
            >
              {isExportingExcel ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>ดาวน์โหลด Excel</span>
            </Button>
            <Button
              onClick={exportToPdf}
              aria-label="ส่งออกรายงาน PDF"
              className="px-3.5 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-2xs h-9 cursor-pointer"
              variant="outline"
              disabled={items.length === 0 || isExportingPdf}
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>ส่งออก PDF</span>
            </Button>
            <Button
              onClick={handlePrint}
              aria-label="พิมพ์รายงาน"
              className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs h-9 cursor-pointer"
              disabled={items.length === 0}
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์รายงาน (Print)</span>
            </Button>
          </>
        }
      />

        {/* Analytical Value Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Asset Valuation */}
          <div className="bg-card p-6 rounded-xl border border-border shadow-xs">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">มูลค่าทรัพย์สินทั้งหมด</p>
            <h3 className="text-2xl font-bold text-card-foreground mt-1">
              {totalValue.toLocaleString('th-TH')} บาท
            </h3>
            <p className="text-xs text-muted-foreground mt-1">คำนวณจากราคาต่อหน่วยที่บันทึกในทะเบียน</p>
          </div>

          {/* Card 2: Audit Rate */}
          <div className="bg-card p-6 rounded-xl border border-border shadow-xs">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">อัตราการสแกนตรวจสอบข้อมูล</p>
            <div className="flex items-center justify-between mt-1">
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {auditProgressPct}%
              </h3>
              <span className="text-xs text-muted-foreground font-bold">
                {auditedCount} / {totalCount} รายการ
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${auditProgressPct}%` }}></div>
            </div>
          </div>

          {/* Card 3: Quality Standard Badge */}
          <div className="bg-card p-6 rounded-xl border border-border shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-card-foreground">มาตรฐานการจัดการสิ่งของ</h4>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">ผ่านเกณฑ์คุณภาพดีเยี่ยม (A+)</p>
              <p className="text-[11px] text-muted-foreground">มีระบบการบันทึกประวัติ RLS ครอบคลุม</p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <form 
          onSubmit={(e) => {
            e.preventDefault()
            handleFilterChange({ q: searchVal })
          }}
          className="rounded-xl border border-border bg-card p-4 shadow-xs flex flex-col gap-3 md:flex-row md:items-center print:hidden"
        >
          <SearchInput
            value={searchVal}
            onChange={(val) => {
              setSearchVal(val)
              handleFilterChange({ q: val.trim() })
            }}
            onClear={() => handleFilterChange({ q: '' })}
            placeholder="ค้นหาด้วยชื่อ, เลขครุภัณฑ์, Serial..."
            className="flex-1 max-w-full"
          />

          <select 
            name="category_id" 
            value={searchParams.category_id ?? ''} 
            onChange={(e) => handleFilterChange({ category_id: e.target.value, page: '1' })}
            className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-card-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
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
            className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-card-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
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
            className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-card-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
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
            className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-card-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
          >
            <option value="">ทุกสถานะ</option>
            {Object.entries(ITEM_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </form>

        {/* Overdue Audits / Maintenance Alert */}
        <div className="bg-card p-6 rounded-xl border border-border shadow-xs print:hidden">
          <h3 className="font-bold text-card-foreground text-sm mb-1.5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>รายการครุภัณฑ์ที่พบชำรุดหรือต้องการตรวจสอบสภาพ (Audit & Repair Alerts)</span>
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            รายการอุปกรณ์ที่ได้รับการแจ้งชำรุด (Damaged) หรือรอการประสานงานซ่อมบำรุงในทะเบียนระบบงานปัจจุบัน
          </p>

          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
            {overdueAuditItems.map((item) => (
              <div key={item.id} className="p-3 bg-muted/50 border border-border rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                    !
                  </div>
                  <div>
                    <p className="font-bold text-card-foreground">{item.item_name}</p>
                    <p className="text-[11px] text-muted-foreground">S/N: {item.serial_no || '-'} | สถานที่: {item.location?.name || '-'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    {ITEM_STATUS_LABELS[item.status as keyof typeof ITEM_STATUS_LABELS]}
                  </span>
                </div>
              </div>
            ))}

            {overdueAuditItems.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs">ครุภัณฑ์ทุกชิ้นอยู่ในสภาพพร้อมใช้งานและไม่มีรายการชำรุดค้างระบบ</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Asset Ledger Table */}
        <div className="relative bg-card p-6 rounded-xl border border-border shadow-xs print:shadow-none print:border-none flex flex-col">
          {isPending && <LoadingOverlay />}
          <div className={`flex-1 min-h-0 flex flex-col transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className="font-bold text-card-foreground text-sm mb-4">รายงานราคาและทรัพย์สินรายตัว (Asset Ledger Valuation)</h3>
            
            <DataTable>
              <DataTableHeader>
                <tr className="border-b border-border bg-muted/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <DataTableHead className="py-2.5 px-3">ชื่อครุภัณฑ์ / หมายเลข</DataTableHead>
                  <DataTableHead className="py-2.5 px-3">หมวดหมู่</DataTableHead>
                  <DataTableHead className="py-2.5 px-3 text-center">จำนวน</DataTableHead>
                  <DataTableHead className="py-2.5 px-3 text-right">ราคาต่อหน่วย</DataTableHead>
                  <DataTableHead className="py-2.5 px-3 text-right">ราคารวม</DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {items.map((item) => {
                  const unitPrice = item.unit_price ?? 0
                  const totalPrice = unitPrice * item.quantity
                  return (
                    <DataTableRow key={item.id} className="hover:bg-muted/50 print:hover:bg-transparent">
                      <DataTableCell className="py-3 px-3">
                        <div className="font-bold text-card-foreground print:text-black">{item.item_name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          S/N: {item.serial_no || item.asset_no || '-'}
                        </div>
                      </DataTableCell>
                      <DataTableCell className="py-3 px-3 text-muted-foreground">{item.category?.name || 'ทั่วไป'}</DataTableCell>
                      <DataTableCell className="py-3 px-3 text-center font-bold text-card-foreground">{item.quantity} {item.unit?.name ?? ''}</DataTableCell>
                      <DataTableCell className="py-3 px-3 text-right font-mono text-card-foreground">{unitPrice.toLocaleString('th-TH')} บาท</DataTableCell>
                      <DataTableCell className="py-3 px-3 text-right font-black font-mono text-card-foreground print:text-black">
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
                  <tr className="border-t-2 border-border bg-muted/50 font-black">
                    <td colSpan={2} className="py-3 px-3 text-card-foreground text-right font-black text-sm">มูลค่ารวมทั้งสิ้น:</td>
                    <td className="py-3 px-3 text-center font-black text-sm text-card-foreground">{totalQuantity} ชิ้น</td>
                    <td colSpan={2} className="py-3 px-3 text-right font-black text-primary text-sm">{totalValue.toLocaleString('th-TH')} บาท</td>
                  </tr>
                </tfoot>
              )}
            </DataTable>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border pt-4 mt-4 print:hidden">
                <div className="text-xs text-muted-foreground font-semibold">
                  แสดงหน้า {currentPage} จากทั้งหมด {totalPages} หน้า (ทั้งหมด {totalCount} รายการ)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => handleFilterChange({ page: String(currentPage - 1) })}
                    className="h-8 px-3 rounded-lg text-xs font-bold border border-input bg-card text-card-foreground hover:bg-muted cursor-pointer"
                  >
                    ก่อนหน้า
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => handleFilterChange({ page: String(currentPage + 1) })}
                    className="h-8 px-3 rounded-lg text-xs font-bold border border-input bg-card text-card-foreground hover:bg-muted cursor-pointer"
                  >
                    ถัดไป
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

    </PageContainer>
  )
}
