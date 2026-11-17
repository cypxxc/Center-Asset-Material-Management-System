'use client'

import { lazy, Suspense, useId, useState } from 'react'
import { ChartNoAxesCombined, ChevronDown, Info } from 'lucide-react'
import { buildAcquisitionSeries, type AcquisitionMetric, type AcquisitionPeriod, type AcquisitionSummary, type YearConvention } from '@/features/reports/acquisition-series'
import { forecastAcquisitions, getPeriodChange } from '@/features/reports/acquisition-trend'
import { acquisitionValueLabel, DashboardAcquisitionPlot } from './dashboard-acquisition-plot'

const number = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 })
const ChartFilterDropdown = lazy(() => import('@/components/ui/filter-dropdown').then(module => ({ default: module.FilterDropdown })))

// Keep a usable select while the shared Items dropdown loads.
export function ChartSelect({ ariaLabel, name, value, options, onChange, allLabel }: {
  ariaLabel: string; name: string; value: string; options: { value: string; label: string }[];
  onChange: (value: string) => void; allLabel: string
}) {
  const fallback = <span className="relative inline-flex min-w-0 items-center">
    <select aria-label={ariaLabel} name={name} value={value} onChange={event => onChange(event.target.value)}
      className="h-9 max-w-44 cursor-pointer appearance-none rounded-lg border border-input bg-card py-1 pl-3 pr-8 text-xs font-semibold text-foreground shadow-2xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
      <option value="">{allLabel}</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 size-3.5 text-muted-foreground" />
  </span>
  return <Suspense fallback={fallback}>
    <ChartFilterDropdown label={allLabel} ariaLabel={ariaLabel} name={name} value={value}
      options={options} onChange={onChange} allLabel={allLabel}
      icon={null} />
  </Suspense>
}

export function DashboardAcquisitionChartClient({ summary, title = 'ทะเบียนทรัพย์สิน', itemType = 'asset' }: { summary: AcquisitionSummary; title?: string; itemType?: 'asset' | 'material' }) {
  const dateBasis = itemType === 'material' ? 'วันที่ยอดคงเหลือหรือวันที่ลงทะเบียน' : 'วันที่ได้มา'
  const id = useId()
  const [convention, setConvention] = useState<YearConvention>('calendar')
  const [year, setYear] = useState<number | null>(null)
  const [metric, setMetric] = useState<AcquisitionMetric>('count')
  const series = buildAcquisitionSeries(summary, convention, year)
  // Keep a selected year visible even if the other convention has no records for it.
  const selectableYears = year === null || series.availableYears.includes(year)
    ? series.availableYears
    : [...series.availableYears, year].sort((a, b) => b - a)
  const prediction = year === null ? forecastAcquisitions(summary, convention, metric) : null
  const forecast = prediction?.forecast
  // Preserve the annual time axis even when the ongoing year has no dated records yet.
  const chartPeriods: AcquisitionPeriod[] = forecast && !series.periods.some(period => period.key === String(forecast.year - 1))
    ? [...series.periods, {
      key: String(forecast.year - 1), label: String(forecast.year + 542),
      fullLabel: `${convention === 'fiscal' ? 'ปีงบประมาณ' : 'ปีปฏิทิน'} ${forecast.year + 542}`,
      recordCount: 0, knownValue: 0, missingPriceCount: 0, future: false, partial: true,
    }] : series.periods
  const displayDate = summary.asOf.split('-').reverse().map((part, index) => index === 2 ? String(Number(part) + 543) : part).join('/')

  return (
    <section aria-labelledby={`${id}-title`} className="w-full min-w-0 rounded-xl border border-border bg-card text-card-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <div>
          <h2 id={`${id}-title`} className="flex items-center gap-2 text-sm font-semibold"><ChartNoAxesCombined className="size-4 text-muted-foreground" aria-hidden="true" />{title}</h2>
        </div>
      </div>
      <div className="space-y-3 px-4 pb-3 pt-2 sm:px-5">
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
          <ChartSelect
            ariaLabel="เลือกประเภทปี"
            name="acquisition-convention"
            value={convention === 'calendar' ? '' : convention}
            options={[{ value: 'fiscal', label: 'ปีงบประมาณ' }]}
            onChange={value => setConvention(value === 'fiscal' ? 'fiscal' : 'calendar')}
            allLabel="ปีปฏิทิน"
          />
          <ChartSelect
            ariaLabel="เลือกข้อมูลที่แสดง"
            name="acquisition-metric"
            value={metric === 'count' ? '' : metric}
            options={[{ value: 'value', label: 'มูลค่าตามทะเบียน' }]}
            onChange={value => setMetric(value === 'value' ? 'value' : 'count')}
            allLabel="จำนวนรายการ"
          />
          <ChartSelect
            ariaLabel="เลือกปี"
            name="acquisition-year"
            value={year === null ? '' : String(year)}
            options={selectableYears.map(value => ({ value: String(value), label: String(value + 543) }))}
            onChange={value => setYear(value ? Number(value) : null)}
            allLabel="ทุกปี"
          />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p aria-live="polite" aria-atomic="true" className="text-xs text-muted-foreground">{series.rangeLabel}</p>
              <p className="text-xs font-normal tabular-nums">
                {metric === 'count' ? `${number.format(series.totals.recordCount)} รายการ`
                  : series.totals.recordCount > 0 && series.totals.missingPriceCount === series.totals.recordCount ? 'ยังไม่มีข้อมูลราคา'
                    : `${number.format(series.totals.knownValue)} บาท`}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground">{series.ongoing ? 'ข้อมูลวันที่' : 'ทะเบียน ณ วันที่'} {displayDate}</p>
          </div>
          {metric === 'value' && series.totals.missingPriceCount > 0 && <p role="status" className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            มูลค่ายังไม่ครบ: ไม่ระบุราคา {number.format(series.totals.missingPriceCount)} รายการในช่วงที่เลือก ยอดรวมเฉพาะรายการที่ระบุราคา
          </p>}
          {series.totals.recordCount === 0 ? <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 text-center">
            <ChartNoAxesCombined className="size-7 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">ยังไม่มีรายการที่ระบุ{dateBasis}ในช่วงนี้</p>
            <p className="text-xs text-muted-foreground">รายการที่ไม่มี{dateBasis}จะไม่รวมในกราฟ</p>
          </div> : <DashboardAcquisitionPlot periods={chartPeriods} metric={metric} forecast={forecast} title={title} dateBasis={dateBasis} showLegend={itemType !== 'material'} />}
          {prediction && (forecast || itemType !== 'material') && <div className="text-xs leading-relaxed text-muted-foreground">
            {forecast ? <>
              <p><span className="font-medium text-foreground">แนวโน้มปี {forecast.year + 543}: ประมาณ {number.format(forecast.value)} {metric === 'count' ? 'รายการ' : 'บาท'}</span> จากแนวโน้มเชิงเส้น {forecast.yearsUsed} ปีที่สิ้นสุดแล้ว ({forecast.trainingStartYear + 543}–{forecast.baselineYear + 543})</p>
            </> : <p>{prediction.reason}</p>}
          </div>}
          {series.periods.length > 0 && <details className="pt-1">
            <summary className="w-fit cursor-pointer rounded text-xs font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring">ดูตารางข้อมูล</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs leading-5">
                <caption className="sr-only">{title} {series.rangeLabel}</caption>
                <thead><tr className="border-b border-border text-muted-foreground"><th scope="col" className="py-2 pr-4 font-medium">ช่วงเวลา</th><th scope="col" className="px-3 py-2 text-right font-medium">จำนวนรายการ</th><th scope="col" className="py-2 pl-3 text-right font-medium">มูลค่าตามทะเบียน</th><th scope="col" className="py-2 pl-3 text-right font-medium">เปลี่ยนแปลง ({metric === 'count' ? 'จำนวน' : 'มูลค่า'})</th></tr></thead>
                <tbody>{chartPeriods.map((period, index) => <tr key={period.key} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="whitespace-nowrap py-2.5 pr-4 font-normal">{period.fullLabel}{period.partial ? ' (ยังไม่ครบช่วง)' : ''}</th>
                  <td className="px-3 py-2.5 text-right tabular-nums">{acquisitionValueLabel(period, 'count')}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{acquisitionValueLabel(period, 'value')}{!period.future && period.missingPriceCount > 0 && period.missingPriceCount !== period.recordCount ? ` · ไม่ระบุราคา ${period.missingPriceCount} รายการ` : ''}</td>
                  <td className="whitespace-nowrap py-2.5 pl-3 text-right tabular-nums">{getPeriodChange(chartPeriods[index - 1], period, metric)?.label ?? '—'}</td>
                </tr>)}
                {forecast && <tr className="border-t border-dashed border-border">
                  <th scope="row" className="whitespace-nowrap py-2.5 pr-4 font-normal">ปี {forecast.year + 543} (คาดการณ์)</th>
                  <td className="px-3 py-2.5 text-right tabular-nums">{metric === 'count' ? `ประมาณ ${number.format(forecast.value)} รายการ` : '—'}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{metric === 'value' ? `ประมาณ ${number.format(forecast.value)} บาท` : '—'}</td>
                  <td className="py-2.5 pl-3 text-right">ค่าประมาณ</td>
                </tr>}</tbody>
              </table>
            </div>
          </details>}
        </div>
      </div>
    </section>
  )
}
