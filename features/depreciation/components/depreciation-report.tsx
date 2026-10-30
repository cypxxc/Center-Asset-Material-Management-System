import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/ui/data-table'
import { TrendingDown } from 'lucide-react'

type Props = Awaited<ReturnType<typeof import('../queries').getDepreciationReport>>
const money = (value: number) =>
  `${value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`

export function DepreciationReport({ items, totals }: Props) {
  return (
    <section className="mt-8 rounded-2xl border border-border/80 bg-card p-6 shadow-2xs print:break-before-page">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/80">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
          <TrendingDown className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            รายงานค่าเสื่อมราคา (Depreciation Schedule)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            เฉพาะครุภัณฑ์ที่กำหนดวิธีเส้นตรง
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          ยังไม่มีครุภัณฑ์ที่กำหนดข้อมูลค่าเสื่อมราคา
        </div>
      ) : (
        <div className="rounded-xl border border-border/80 overflow-hidden">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="border-b border-border/80 bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <DataTableHead className="py-3 px-4">ครุภัณฑ์</DataTableHead>
                <DataTableHead className="py-3 px-4">วันเริ่ม</DataTableHead>
                <DataTableHead className="py-3 px-4 text-right">มูลค่าพร้อมใช้งาน</DataTableHead>
                <DataTableHead className="py-3 px-4 text-right">ค่าเสื่อมสะสม</DataTableHead>
                <DataTableHead className="py-3 px-4 text-right">มูลค่าสุทธิ</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {items.map((item) => (
                <DataTableRow
                  key={item.id}
                  className="h-12 hover:bg-muted/30 transition-colors border-b border-border/40"
                >
                  <DataTableCell className="py-3 px-4">
                    <div className="font-semibold text-xs text-foreground">{item.item_name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      {item.asset_no || '-'}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="py-3 px-4 font-mono text-xs text-muted-foreground">
                    {item.depreciation_start_date}
                  </DataTableCell>
                  <DataTableCell className="py-3 px-4 text-right font-mono text-xs tabular-nums text-foreground">
                    {money(item.depreciation_cost ?? 0)}
                  </DataTableCell>
                  <DataTableCell className="py-3 px-4 text-right font-mono text-xs tabular-nums text-amber-600 dark:text-amber-400">
                    {money(item.accumulatedDepreciation)}
                  </DataTableCell>
                  <DataTableCell className="py-3 px-4 text-right font-mono font-bold text-xs tabular-nums text-foreground">
                    {money(item.netBookValue)}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              มูลค่าพร้อมใช้งานรวม:
            </span>
            <strong className="text-base font-extrabold font-mono text-foreground mt-1 block">
              {money(totals.cost)}
            </strong>
          </div>
          <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              ค่าเสื่อมสะสมรวม:
            </span>
            <strong className="text-base font-extrabold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
              {money(totals.accumulated)}
            </strong>
          </div>
          <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5">
            <span className="text-[11px] font-medium text-primary uppercase tracking-wider block">
              มูลค่าสุทธิรวม:
            </span>
            <strong className="text-base font-extrabold font-mono text-primary mt-1 block">
              {money(totals.netBook)}
            </strong>
          </div>
        </div>
      )}
    </section>
  )
}
