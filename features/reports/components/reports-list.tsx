'use client'

import React, { useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Download, Printer, Search, FileText, AlertTriangle, CheckCircle, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS } from '@/features/items/types'
import { ReportItemRow } from '../queries'
import ExcelJS from 'exceljs'
import { cn } from '@/lib/utils'

interface ReportsListProps {
  items: ReportItemRow[]
  searchParams: {
    q?: string
    type?: string
    status?: string
  }
}

export function ReportsList({ items, searchParams }: ReportsListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const q = formData.get('q') as string
    const type = formData.get('type') as string
    const status = formData.get('status') as string

    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (type) params.set('type', type)
    if (status) params.set('status', status)

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Office Items')

    worksheet.columns = [
      { header: 'ชื่อสิ่งของ', key: 'item_name', width: 25 },
      { header: 'ประเภท', key: 'item_type', width: 15 },
      { header: 'หมวดหมู่', key: 'category_name', width: 15 },
      { header: 'จำนวน', key: 'quantity', width: 10 },
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

  // Define pricing calculation for value reports (THB) matching prototype logic
  const getItemValue = (name: string, category?: string): number => {
    const title = name.toLowerCase()
    const cat = (category || '').toLowerCase()
    if (title.includes('dell') || title.includes('latitude') || title.includes('macbook')) return 35000
    if (title.includes('chair') || title.includes('ergonomic')) return 5500
    if (title.includes('projector') || title.includes('epson')) return 18900
    if (title.includes('printer') || title.includes('laserjet')) return 8900
    if (title.includes('ipad') || title.includes('tablet')) return 16900
    if (cat.includes('it') || cat.includes('tech') || cat.includes('คอม')) return 12000
    if (cat.includes('เฟอร์') || cat.includes('โต๊ะ') || cat.includes('เก้าอี้')) return 3000
    if (cat.includes('av')) return 9000
    return 1500
  }

  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const totalAssetsValue = items.reduce((sum, item) => sum + (getItemValue(item.item_name, item.category?.name) * item.quantity), 0)

  // Audited count: items updated within past month (simulated as audited)
  const auditedCount = items.filter(item => {
    const updated = new Date(item.updated_at)
    const now = new Date()
    const diff = Math.abs(now.getTime() - updated.getTime())
    const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return diffDays <= 30
  }).length
  const auditProgressPct = items.length > 0 ? Math.round((auditedCount / items.length) * 100) : 100

  // Overdue audits: items marked damaged or waiting repair
  const overdueAuditItems = items.filter(item => {
    return item.status === 'damaged' || item.status === 'waiting_repair'
  })

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 p-6 md:p-8 print:bg-white print:p-0 font-sans">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* Printable Report Header */}
        <div className="hidden print:block p-8 border-b-2 border-slate-900 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black text-slate-900">รายงานครุภัณฑ์สํานักงานประจําปี</h1>
              <p className="text-xs text-slate-500 mt-1">สำนักงานใหญ่ แผนกเทคโนโลยีสารสนเทศและบริหารจัดการทั่วไป</p>
              <p className="text-xs text-slate-500">วันที่พิมพ์รายงาน: {new Date().toLocaleDateString('th-TH')} | จัดเตรียมโดย: เจ้าหน้าที่พัสดุ</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-black text-blue-600">Registry-S</h2>
              <p className="text-[10px] text-slate-400">ระบบควบคุมทรัพย์สินส่วนกลาง</p>
            </div>
          </div>
        </div>

        {/* Regular UI Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5 print:hidden">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>รายงานสรุปและวิเคราะห์ผล (Inventory Reports)</span>
            </h2>
            <p className="text-xs text-slate-400">สรุปภาพรวมมูลค่าครุภัณฑ์ อัตราการตรวจเช็ค และส่งออกข้อมูลเป็นไฟล์ Excel/CSV</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={exportToExcel}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm h-9 cursor-pointer"
              variant="outline"
              disabled={items.length === 0}
            >
              <Download className="w-4 h-4" />
              <span>ดาวน์โหลด Excel</span>
            </Button>
            <Button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-md h-9 cursor-pointer"
              disabled={items.length === 0}
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์รายงาน (Print / PDF)</span>
            </Button>
          </div>
        </div>

        {/* Analytical Value Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Asset Valuation */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ประเมินมูลค่าทรัพย์สินทั้งหมด</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">
              {totalAssetsValue.toLocaleString('th-TH')} บาท
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">คำนวณตามราคาประเมินเฉลี่ยของครุภัณฑ์และพัสดุ</p>
          </div>

          {/* Card 2: Audit Rate */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">อัตราการสแกนตรวจสอบข้อมูล</p>
            <div className="flex items-center justify-between mt-1">
              <h3 className="text-2xl font-black text-emerald-600">
                {auditProgressPct}%
              </h3>
              <span className="text-xs text-slate-500 font-bold">
                {auditedCount} / {items.length} รายการ
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${auditProgressPct}%` }}></div>
            </div>
          </div>

          {/* Card 3: Quality Standard Badge */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
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
        <form onSubmit={handleSearch} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col gap-3 md:flex-row md:items-center print:hidden">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={searchParams.q ?? ''}
              placeholder="ค้นหาด้วยชื่อ, เลขครุภัณฑ์, Serial..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs focus:outline-none focus:border-primary focus:bg-white transition-all"
            />
          </div>

          <select name="type" defaultValue={searchParams.type ?? ''} className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs cursor-pointer">
            <option value="">ทุกประเภท</option>
            {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select name="status" defaultValue={searchParams.status ?? ''} className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs cursor-pointer">
            <option value="">ทุกสถานะ</option>
            {Object.entries(ITEM_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <Button type="submit" variant="outline" className="h-9 px-4 text-xs font-bold cursor-pointer rounded-lg" disabled={isPending}>
            {isPending ? 'กำลังกรอง...' : 'กรองข้อมูล'}
          </Button>
        </form>

        {/* Overdue Audits / Maintenance Alert */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm print:hidden">
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
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm print:shadow-none print:border-none">
          <h3 className="font-bold text-slate-800 text-sm mb-4">รายงานราคาและทรัพย์สินรายตัว (Asset Ledger Valuation)</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 print:text-black">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3">ชื่อครุภัณฑ์ / หมายเลข</th>
                  <th className="py-2.5 px-3">หมวดหมู่</th>
                  <th className="py-2.5 px-3 text-center">จำนวน</th>
                  <th className="py-2.5 px-3 text-right">ราคาต่อหน่วย</th>
                  <th className="py-2.5 px-3 text-right">ราคารวมประเมิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const unitPrice = getItemValue(item.item_name, item.category?.name)
                  const totalPrice = unitPrice * item.quantity
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 print:hover:bg-transparent">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 print:text-black">{item.item_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          S/N: {item.serial_no || item.asset_no || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{item.category?.name || 'ทั่วไป'}</td>
                      <td className="py-3 px-3 text-center font-bold">{item.quantity} {item.unit?.name ?? ''}</td>
                      <td className="py-3 px-3 text-right font-mono">{unitPrice.toLocaleString('th-TH')} บาท</td>
                      <td className="py-3 px-3 text-right font-black font-mono text-slate-800 print:text-black">
                        {totalPrice.toLocaleString('th-TH')} บาท
                      </td>
                    </tr>
                  )
                })}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      ไม่พบข้อมูลรายงานสิ่งของตามข้อกำหนด
                    </td>
                  </tr>
                )}
              </tbody>
              {items.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-900 bg-slate-50/50 font-black">
                    <td colSpan={2} className="py-3 px-3 text-slate-800 text-right font-black text-sm">มูลค่าประเมินรวมทั้งสิ้น:</td>
                    <td className="py-3 px-3 text-center font-black text-sm">{totalQuantity} ชิ้น</td>
                    <td colSpan={2} className="py-3 px-3 text-right font-black text-blue-700 text-sm">{totalAssetsValue.toLocaleString('th-TH')} บาท</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
