import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '@/components/ui/data-table'

type Props = Awaited<ReturnType<typeof import('../queries').getDepreciationReport>>
const money = (value: number) => `${value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`

export function DepreciationReport({ items, totals }: Props) {
  return <section className="mt-8 rounded-xl border border-border bg-card p-5 print:break-before-page">
    <div className="mb-4"><h2 className="text-lg font-bold">รายงานค่าเสื่อมราคา</h2><p className="text-sm text-muted-foreground">เฉพาะครุภัณฑ์ที่กำหนดวิธีเส้นตรง</p></div>
    {items.length === 0 ? <p className="py-6 text-sm text-muted-foreground">ยังไม่มีครุภัณฑ์ที่กำหนดข้อมูลค่าเสื่อมราคา</p> : <DataTable><DataTableHeader><DataTableRow><DataTableHead>ครุภัณฑ์</DataTableHead><DataTableHead>วันเริ่ม</DataTableHead><DataTableHead className="text-right">มูลค่าพร้อมใช้งาน</DataTableHead><DataTableHead className="text-right">ค่าเสื่อมสะสม</DataTableHead><DataTableHead className="text-right">มูลค่าสุทธิ</DataTableHead></DataTableRow></DataTableHeader><DataTableBody>{items.map((item) => <DataTableRow key={item.id}><DataTableCell><div className="font-medium">{item.item_name}</div><div className="text-xs text-muted-foreground">{item.asset_no || '-'}</div></DataTableCell><DataTableCell>{item.depreciation_start_date}</DataTableCell><DataTableCell className="text-right">{money(item.depreciation_cost ?? 0)}</DataTableCell><DataTableCell className="text-right">{money(item.accumulatedDepreciation)}</DataTableCell><DataTableCell className="text-right font-semibold">{money(item.netBookValue)}</DataTableCell></DataTableRow>)}</DataTableBody></DataTable>}
    {items.length > 0 && <div className="mt-4 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm"><span>มูลค่าพร้อมใช้งานรวม: <strong>{money(totals.cost)}</strong></span><span>ค่าเสื่อมสะสมรวม: <strong>{money(totals.accumulated)}</strong></span><span>มูลค่าสุทธิรวม: <strong>{money(totals.netBook)}</strong></span></div>}
  </section>
}
