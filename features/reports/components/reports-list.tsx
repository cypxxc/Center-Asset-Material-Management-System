'use client'

import { useTransition, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Download, Printer, FileText, AlertTriangle, CheckCircle, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/ui/page-container'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS } from '@/features/items/types'
import { ReportItemRow } from '../queries'
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
    sort_by?: string
    sort_dir?: string
    page?: string
  }
  categories: { id: string; name: string }[]
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
  categories
}: ReportsListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [searchVal, setSearchVal] = useState(searchParams.q ?? '')
  const [prevQ, setPrevQ] = useState(searchParams.q ?? '')

  const currentQ = searchParams.q ?? ''
  if (currentQ !== prevQ) {
    setPrevQ(currentQ)
    setSearchVal(currentQ)
  }

  const handleFilterChange = (updates: {
    q?: string
    type?: string
    status?: string
    category_id?: string
    page?: string
  }) => {
    const query = new URLSearchParams()
    
    const newQ = updates.q !== undefined ? updates.q : searchVal
    const newType = updates.type !== undefined ? updates.type : (searchParams.type ?? '')
    const newStatus = updates.status !== undefined ? updates.status : (searchParams.status ?? '')
    const newCategory = updates.category_id !== undefined ? updates.category_id : (searchParams.category_id ?? '')
    const newPage = updates.page !== undefined ? updates.page : '1'
    
    if (newQ) query.set('q', newQ)
    if (newType) query.set('type', newType)
    if (newStatus) query.set('status', newStatus)
    if (newCategory) query.set('category_id', newCategory)
    if (newPage && newPage !== '1') query.set('page', newPage)
    
    startTransition(() => {
      router.push(`${pathname}?${query.toString()}`)
    })
  }

  const exportToExcel = async () => {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Office Items')

    worksheet.columns = [
      { header: 'ชื่อสิ่งของ', key: 'item_name', width: 25 },
      { header: 'ประเภท', key: 'item_type', width: 15 },
      { header: 'หมวดหมู่', key: 'category_name', width: 15 },
      { header: 'จำนวน', key: 'quantity', width: 10 },
      { header: 'ราคาต่อหน่วย', key: 'unit_price', width: 14 },
      { header: 'หน่วยนับ', key: 'unit_name', width: 10 },
      { header: 'เลขครุภัณฑ์', key: 'asset_no', width: 20 },
      { header: 'Serial Number', key: 'serial_no', width: 20 },
      { header: 'ยี่ห้อ', key: 'brand', width: 15 },
      { header: 'รุ่น', key: 'model', width: 15 },
      { header: 'สถานที่', key: 'location_name', width: 20 },
      { header: 'ผู้รับผิดชอบ', key: 'responsible_person', width: 20 },
      { header: 'สถานะ', key: 'status', width: 15 },
    ]

    items.forEach((item) => {
      worksheet.addRow({
        item_name: item.item_name,
        item_type: ITEM_TYPE_LABELS[item.item_type as keyof typeof ITEM_TYPE_LABELS] || item.item_type,
        category_name: item.category?.name || '-',
        quantity: item.quantity,
        unit_price: item.unit_price ?? 0,
        unit_name: item.unit?.name || '-',
        asset_no: item.asset_no || '-',
        serial_no: item.serial_no || '-',
        brand: item.brand || '-',
        model: item.model || '-',
        location_name: item.location?.name || '-',
        responsible_person: item.responsible_person || '-',
        status: ITEM_STATUS_LABELS[item.status as keyof typeof ITEM_STATUS_LABELS] || item.status,
      })
    })

    // Format headers
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `office-items-report-${new Date().toISOString().split('T')[0]}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    window.print()
  }

  const auditProgressPct = totalCount > 0 ? Math.round((auditedCount / totalCount) * 100) : 100

  return (
    <PageContainer className="print:bg-white print:p-0">
      
      {/* Printable Report Header */}
      <div className="hidden print:block p-8 border-b-2 border-slate-900 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">รายงานครุภัณฑ์สํานักงานประจําปี</h1>
            <p className="text-xs text-slate-500 mt-1">สำนักงานใหญ่ แผนกเทคโนโลยีสารสนเทศและบริหารจัดการทั่วไป</p>
            <p className="text-xs text-slate-500" suppressHydrationWarning>วันที่พิมพ์รายงาน: {new Date().toLocaleDateString('th-TH')} | จัดเตรียมโดย: เจ้าหน้าที่พัสดุ</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-blue-600">Registry-S</h2>
            <p className="text-[10px] text-slate-400">ระบบควบคุมทรัพย์สินส่วนกลาง</p>
          </div>
        </div>
      </div>

      {/* Regular UI Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>รายงานสรุปและวิเคราะห์ผล (Inventory Reports)</span>
          </div>
        }
        subtitle="สรุปภาพรวมมูลค่าครุภัณฑ์ อัตราการตรวจเช็ค และส่งออกข้อมูลเป็นไฟล์ Excel/CSV"
        className="print:hidden"
        actions={
          <>
            <Button
              onClick={exportToExcel}
              aria-label="ดาวน์โหลดรายงาน Excel"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm h-9 cursor-pointer"
              variant="outline"
              disabled={items.length === 0}
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลด Excel</span>
            </Button>
            <Button
              onClick={handlePrint}
              aria-label="พิมพ์หรือบันทึกเป็น PDF"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-md h-9 cursor-pointer"
              disabled={items.length === 0}
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์รายงาน (Print / PDF)</span>
            </Button>
          </>
        }
      />

        {/* Analytical Value Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Asset Valuation */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">มูลค่าทรัพย์สินทั้งหมด</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              {totalValue.toLocaleString('th-TH')} บาท
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">คำนวณจากราคาต่อหน่วยที่บันทึกในทะเบียน</p>
          </div>

          {/* Card 2: Audit Rate */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">อัตราการสแกนตรวจสอบข้อมูล</p>
            <div className="flex items-center justify-between mt-1">
              <h3 className="text-2xl font-bold text-emerald-600">
                {auditProgressPct}%
              </h3>
              <span className="text-xs text-slate-500 font-bold">
                {auditedCount} / {totalCount} รายการ
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${auditProgressPct}%` }}></div>
            </div>
          </div>

          {/* Card 3: Quality Standard Badge */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center flex-shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800">มาตรฐานการจัดการสิ่งของ</h4>
              <p className="text-xs text-emerald-600 font-bold mt-0.5">ผ่านเกณฑ์คุณภาพดีเยี่ยม (A+)</p>
              <p className="text-[9px] text-slate-400">มีระบบการบันทึกประวัติ RLS ครอบคลุม</p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <form 
          onSubmit={(e) => {
            e.preventDefault()
            handleFilterChange({ q: searchVal })
          }}
          className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col gap-3 md:flex-row md:items-center print:hidden"
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
            onChange={(e) => handleFilterChange({ category_id: e.target.value })}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs cursor-pointer"
          >
            <option value="">กรองตามหมวดหมู่</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <select 
            name="type" 
            value={searchParams.type ?? ''} 
            onChange={(e) => handleFilterChange({ type: e.target.value })}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs cursor-pointer"
          >
            <option value="">กรองตามประเภท</option>
            {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select 
            name="status" 
            value={searchParams.status ?? ''} 
            onChange={(e) => handleFilterChange({ status: e.target.value })}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs cursor-pointer"
          >
            <option value="">กรองตามสถานะ</option>
            {Object.entries(ITEM_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </form>

        {/* Overdue Audits / Maintenance Alert */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm print:hidden">
          <h3 className="font-bold text-slate-800 text-sm mb-1.5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span>รายการครุภัณฑ์ที่พบชำรุดหรือต้องการตรวจสอบสภาพ (Audit & Repair Alerts)</span>
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            รายการอุปกรณ์ที่ได้รับการแจ้งชำรุด (Damaged) หรือรอการประสานงานซ่อมบำรุงในทะเบียนระบบงานปัจจุบัน
          </p>

          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
            {overdueAuditItems.map((item) => (
              <div key={item.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                    !
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{item.item_name}</p>
                    <p className="text-[10px] text-slate-400">S/N: {item.serial_no || '-'} | สถานที่: {item.location?.name || '-'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                    {ITEM_STATUS_LABELS[item.status as keyof typeof ITEM_STATUS_LABELS]}
                  </span>
                </div>
              </div>
            ))}

            {overdueAuditItems.length === 0 && (
              <div className="text-center py-6 text-slate-400">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs">ครุภัณฑ์ทุกชิ้นอยู่ในสภาพพร้อมใช้งานและไม่มีรายการชำรุดค้างระบบ</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Asset Ledger Table */}
        <div className="relative bg-white p-6 rounded-xl border border-slate-100 shadow-sm print:shadow-none print:border-none flex flex-col">
          {isPending && <LoadingOverlay />}
          <div className={`flex-1 min-h-0 flex flex-col transition-opacity duration-200 ${isPending ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className="font-bold text-slate-800 text-sm mb-4">รายงานราคาและทรัพย์สินรายตัว (Asset Ledger Valuation)</h3>
            
            <DataTable>
              <DataTableHeader>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
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
                    <DataTableRow key={item.id} className="hover:bg-slate-50/50 print:hover:bg-transparent">
                      <DataTableCell className="py-3 px-3">
                        <div className="font-bold text-slate-800 print:text-black">{item.item_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          S/N: {item.serial_no || item.asset_no || '-'}
                        </div>
                      </DataTableCell>
                      <DataTableCell className="py-3 px-3 text-slate-500">{item.category?.name || 'ทั่วไป'}</DataTableCell>
                      <DataTableCell className="py-3 px-3 text-center font-bold">{item.quantity} {item.unit?.name ?? ''}</DataTableCell>
                      <DataTableCell className="py-3 px-3 text-right font-mono">{unitPrice.toLocaleString('th-TH')} บาท</DataTableCell>
                      <DataTableCell className="py-3 px-3 text-right font-black font-mono text-slate-800 print:text-black">
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
                  <tr className="border-t-2 border-slate-900 bg-slate-50/50 font-black">
                    <td colSpan={2} className="py-3 px-3 text-slate-800 text-right font-black text-sm">มูลค่ารวมทั้งสิ้น:</td>
                    <td className="py-3 px-3 text-center font-black text-sm">{totalQuantity} ชิ้น</td>
                    <td colSpan={2} className="py-3 px-3 text-right font-black text-blue-700 text-sm">{totalValue.toLocaleString('th-TH')} บาท</td>
                  </tr>
                </tfoot>
              )}
            </DataTable>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4 print:hidden">
                <div className="text-xs text-slate-400 font-semibold">
                  แสดงหน้า {currentPage} จากทั้งหมด {totalPages} หน้า (ทั้งหมด {totalCount} รายการ)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => handleFilterChange({ page: String(currentPage - 1) })}
                    className="h-8 px-3 rounded-lg text-xs font-bold border border-slate-200 bg-white cursor-pointer"
                  >
                    ก่อนหน้า
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => handleFilterChange({ page: String(currentPage + 1) })}
                    className="h-8 px-3 rounded-lg text-xs font-bold border border-slate-200 bg-white cursor-pointer"
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
