'use client'

import { useId, useState } from 'react'
import { ChartNoAxesCombined, Info } from 'lucide-react'
import { ChartSelect } from './dashboard-acquisition-chart-client'
import { buildCompletedDisbursementSeries, type CompletedDisbursementSummary } from '@/features/reports/completed-disbursement-series'
import type { YearConvention } from '@/features/reports/acquisition-series'
import { DashboardDisbursementPlot } from './dashboard-disbursement-plot'

const number = new Intl.NumberFormat('th-TH')
export const disbursementChartTitle = 'ยอดรวมการยืมและเบิกที่สำเร็จ'

export function DashboardDisbursementChartClient({ summary }: { summary: CompletedDisbursementSummary }) {
  const id = useId()
  const [convention, setConvention] = useState<YearConvention>('calendar')
  const [year, setYear] = useState<number | null>(null)
  const series = buildCompletedDisbursementSeries(summary, convention, year)
  const annual = year === null
  return <section aria-labelledby={`${id}-title`} className="w-full min-w-0 rounded-xl border border-border bg-card text-card-foreground">
    <h2 id={`${id}-title`} className="flex items-center gap-2 px-4 pt-4 text-sm font-semibold sm:px-5">
      <ChartNoAxesCombined className="size-4 text-muted-foreground" aria-hidden="true" />{disbursementChartTitle}
    </h2>
    <p className="px-4 pt-1 text-xs text-muted-foreground sm:px-5">ยอด{annual ? 'รายปี' : 'รายเดือน'} · ความสูงของแท่งแสดงยอดรวม ส่วนในแท่งแยกยืมและเบิก</p>
    <div className="space-y-3 px-4 pb-4 pt-2 sm:px-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        <ChartSelect ariaLabel="เลือกประเภทปีของการยืมและเบิก" name={`${id}-convention`}
          value={convention === 'calendar' ? '' : convention} allLabel="ปีปฏิทิน"
          options={[{ value: 'fiscal', label: 'ปีงบประมาณ' }]}
          onChange={value => {
            const nextConvention = value === 'fiscal' ? 'fiscal' : 'calendar'
            const years = buildCompletedDisbursementSeries(summary, nextConvention, null).availableYears
            if (year !== null && years.length && !years.includes(year)) setYear(years[0])
            setConvention(nextConvention)
          }} />
        <ChartSelect ariaLabel="เลือกปีของการยืมและเบิก" name={`${id}-year`}
          value={year === null ? '' : String(year)} allLabel="ทุกปี"
          options={series.availableYears.map(value => ({ value: String(value), label: String(value + 543) }))}
          onChange={value => setYear(value ? Number(value) : null)} />
      </div>
      <div aria-live="polite" aria-atomic="true" className="space-y-2">
        <p className="text-xs text-muted-foreground">{series.rangeLabel}</p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs tabular-nums">
          <span className="text-xl font-semibold tracking-tight">รวม {number.format(series.totals.total)} ครั้ง</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-sm bg-primary" />ยืม {number.format(series.totals.borrowed)} ครั้ง</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-sm border border-foreground bg-muted-foreground" />เบิก {number.format(series.totals.issued)} ครั้ง</span>
        </p>
      </div>
      {summary.unrecordedHandoverCount > 0 && <p role="status" className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        ยังไม่มีวันที่ส่งมอบจริง {number.format(summary.unrecordedHandoverCount)} รายการ (กราฟใช้วันที่อนุมัติแทนเมื่อมีข้อมูล)
      </p>}
      {series.totals.total === 0 ? <div role="status" className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
        <ChartNoAxesCombined className="size-7 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">ยังไม่มีรายการยืมหรือเบิกที่สำเร็จในช่วงนี้</p>
      </div> : <DashboardDisbursementPlot periods={series.periods} annual={annual} />}
      {series.periods.length > 0 && <details>
        <summary className="w-fit cursor-pointer rounded text-xs font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring">ดูตารางข้อมูล</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs leading-5">
            <caption className="sr-only">{disbursementChartTitle} {series.rangeLabel}</caption>
            <thead><tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">{annual ? 'ปี' : 'เดือน'}</th>
              {['ยืม (ครั้ง)', 'เบิก (ครั้ง)', 'รวม (ครั้ง)'].map(label => <th key={label} scope="col" className="px-3 py-2 text-right font-medium">{label}</th>)}
            </tr></thead>
            <tbody>{series.periods.map(period => <tr key={period.key} className="border-b border-border/60 last:border-0">
              <th scope="row" className="whitespace-nowrap py-2.5 pr-4 font-normal">{period.fullLabel}</th>
              {[period.borrowed, period.issued, period.total].map((value, index) => <td key={index} className="px-3 py-2.5 text-right tabular-nums">{period.future ? 'ยังไม่ถึงช่วงเวลา' : number.format(value)}</td>)}
            </tr>)}</tbody>
            <tfoot><tr className="border-t border-border font-semibold"><th scope="row" className="py-2 pr-4">รวม</th>
              {[series.totals.borrowed, series.totals.issued, series.totals.total].map((value, index) => <td key={index} className="px-3 py-2 text-right tabular-nums">{number.format(value)}</td>)}
            </tr></tfoot>
          </table>
        </div>
      </details>}
    </div>
  </section>
}
