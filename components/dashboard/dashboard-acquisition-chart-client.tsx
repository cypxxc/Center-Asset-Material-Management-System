'use client'

import { lazy, Suspense, useId, useState } from 'react'
import { ChartNoAxesCombined, ChevronDown, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  const fallback = (
    <span className="relative inline-flex min-w-0 items-center">
      <select
        aria-label={ariaLabel}
        name={name}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-8 max-w-44 cursor-pointer appearance-none rounded-md border border-border/80 bg-background/50 py-1 pl-2.5 pr-7 text-xs font-medium text-foreground shadow-2xs outline-none transition-colors hover:bg-muted/60 hover:border-border focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">{allLabel}</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
    </span>
  )
  return (
    <Suspense fallback={fallback}>
      <ChartFilterDropdown
        label={allLabel}
        ariaLabel={ariaLabel}
        name={name}
        value={value}
        options={options}
        onChange={onChange}
        allLabel={allLabel}
        icon={null}
      />
    </Suspense>
  )
}

export function DashboardAcquisitionChartClient({
  summary,
  title = 'ทะเบียนครุภัณฑ์',
  itemType = 'asset',
  showMetricSelect = false,
}: {
  summary: AcquisitionSummary
  title?: string
  itemType?: 'asset' | 'material'
  showMetricSelect?: boolean
}) {
  const dateBasis = itemType === 'material' ? 'วันที่ยอดคงเหลือหรือวันที่ลงทะเบียน' : 'วันที่ได้มา'
  const id = useId()
  const [convention, setConvention] = useState<YearConvention>('calendar')

  const [currentYearNum, currentMonthNum] = summary.asOf ? summary.asOf.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1]
  const currentPeriodYear = currentYearNum + (convention === 'fiscal' && currentMonthNum >= 10 ? 1 : 0)

  const [year, setYear] = useState<number | null>(null)
  const [metric, setMetric] = useState<AcquisitionMetric>('value')
  const series = buildAcquisitionSeries(summary, convention, year)

  // Keep a selected year visible even if the other convention has no records for it.
  const selectableYears: number[] = year === null || series.availableYears.includes(year)
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

  // แสดงเฉพาะข้อมูล 5 ปีล่าสุด รวมปีปัจจุบัน (หากมีน้อยกว่า 5 ปี ให้แสดงเท่าที่มี)
  const displayPeriods: AcquisitionPeriod[] = year === null
    ? chartPeriods.filter(period => {
        const pYear = Number(period.key)
        return pYear >= currentPeriodYear - 4 && pYear <= currentPeriodYear
      })
    : chartPeriods
  const displayDate = summary.asOf.split('-').reverse().map((part, index) => index === 2 ? String(Number(part) + 543) : part).join('/')

  return (
    <section aria-labelledby={`${id}-title`} className="w-full min-w-0 rounded-xl border border-border bg-card text-card-foreground shadow-2xs overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3.5 pb-3 sm:px-5 border-b border-border/60 bg-card">
        <div>
          <h2 id={`${id}-title`} className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ChartNoAxesCombined
              className={cn("size-4", itemType === 'material' ? "text-violet-600 dark:text-violet-400" : "text-blue-600 dark:text-blue-400")}
              aria-hidden="true"
            />
            {title}
          </h2>
        </div>
      </div>
      <div className="space-y-3 px-4 pb-4 pt-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <ChartSelect
              ariaLabel="เลือกประเภทปี"
              name={`${id}-convention`}
              value={convention === 'calendar' ? '' : convention}
              options={[{ value: 'fiscal', label: 'ปีงบประมาณ' }]}
              onChange={value => setConvention(value === 'fiscal' ? 'fiscal' : 'calendar')}
              allLabel="ปีปฏิทิน"
            />
            <ChartSelect
              ariaLabel="เลือกปี"
              name={`${id}-year`}
              value={year === null ? '' : String(year)}
              options={selectableYears.map(value => ({ value: String(value), label: String(value + 543) }))}
              onChange={value => setYear(value ? Number(value) : null)}
              allLabel="ทุกปี"
            />
            {showMetricSelect && (
              <ChartSelect
                ariaLabel="เลือกข้อมูลที่แสดง"
                name="acquisition-metric"
                value={metric}
                allLabel="จำนวนรายการ"
                options={[{ value: 'value', label: 'มูลค่าตามทะเบียน' }]}
                onChange={value => setMetric(value === 'value' ? 'value' : 'count')}
              />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span
              title={`ข้อมูล ณ วันที่ ${displayDate} (${series.rangeLabel})`}
              className="inline-flex items-center gap-1 text-[11px] tabular-nums cursor-help hover:text-foreground"
            >
              <span>{displayDate}</span>
              <Info className="size-3.5 text-muted-foreground/80" aria-hidden="true" />
            </span>
            <span className="sr-only" aria-live="polite">{series.rangeLabel}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">{series.rangeLabel}</p>
              <div className="flex items-baseline gap-1.5 pt-0.5">
                <span className="text-xl font-bold font-mono tracking-tight text-foreground">
                  {metric === 'count' ? (
                    <>
                      {number.format(series.totals.recordCount)}{' '}
                      <span className="text-sm font-normal font-sans text-muted-foreground">รายการ</span>
                    </>
                  ) : series.totals.recordCount > 0 && series.totals.missingPriceCount === series.totals.recordCount ? (
                    'ยังไม่มีข้อมูลราคา'
                  ) : (
                    <>
                      {number.format(series.totals.knownValue)}{' '}
                      <span className="text-sm font-normal font-sans text-muted-foreground">บาท</span>
                    </>
                  )}
                </span>
                {metric === 'count' && series.totals.knownValue > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({number.format(series.totals.knownValue)} บาท)
                  </span>
                )}
                {metric === 'value' && series.totals.recordCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({number.format(series.totals.recordCount)} รายการ)
                  </span>
                )}
              </div>
            </div>

            {metric === 'value' && series.totals.missingPriceCount > 0 && (
              <p role="status" className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                มูลค่ายังไม่ครบ: ไม่ระบุราคา {number.format(series.totals.missingPriceCount)} รายการในช่วงที่เลือก ยอดรวมเฉพาะรายการที่ระบุราคา
              </p>
            )}
          </div>

          {prediction && itemType !== 'material' && forecast && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span>คาดการณ์ปี {forecast.year + 543}:</span>
              <span className="font-semibold text-foreground font-mono">~{number.format(forecast.value)} บาท</span>
              <span
                title={`คำนวณจากแนวโน้มเชิงเส้น ${forecast.yearsUsed} ปีย้อนหลัง (${forecast.trainingStartYear + 543}–${forecast.baselineYear + 543})`}
                className="inline-flex items-center cursor-help text-muted-foreground hover:text-foreground"
              >
                <Info className="size-3" aria-hidden="true" />
              </span>
            </p>
          )}

          {series.totals.recordCount === 0 && itemType !== 'material' ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 text-center">
              <ChartNoAxesCombined className="size-7 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">ยังไม่มีรายการที่ระบุ{dateBasis}ในช่วงนี้</p>
            </div>
          ) : (
            <DashboardAcquisitionPlot
              periods={displayPeriods}
              metric={metric}
              forecast={forecast}
              title={title}
              dateBasis={dateBasis}
              showLegend={itemType !== 'material'}
              chartType={itemType === 'material' ? 'bar' : 'line'}
              itemType={itemType}
            />
          )}

          {series.periods.length > 0 && (
            <details className="pt-0.5">
              <summary className="w-fit cursor-pointer rounded text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring">
                ดูตารางข้อมูล
              </summary>
              <div className="mt-2.5 overflow-x-auto">
                <table className="w-full text-left text-xs leading-5">
                  <caption className="sr-only">{title} {series.rangeLabel}</caption>
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">ช่วงเวลา</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">จำนวนรายการ</th>
                      <th scope="col" className="py-2 pl-3 text-right font-medium">มูลค่าตามทะเบียน</th>
                      <th scope="col" className="py-2 pl-3 text-right font-medium">เปลี่ยนแปลง ({metric === 'count' ? 'จำนวน' : 'มูลค่า'})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayPeriods.map((period, index) => (
                      <tr key={period.key} className="border-b border-border/60 last:border-0">
                        <th scope="row" className="whitespace-nowrap py-2 pr-4 font-normal">
                          {period.fullLabel}{period.partial ? ' (ยังไม่ครบช่วง)' : ''}
                        </th>
                        <td className="px-3 py-2 text-right tabular-nums">{acquisitionValueLabel(period, 'count')}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{acquisitionValueLabel(period, 'value')}</td>
                        <td className="whitespace-nowrap py-2 pl-3 text-right tabular-nums">
                          {getPeriodChange(displayPeriods[index - 1], period, metric)?.label ?? '—'}
                        </td>
                      </tr>
                    ))}
                    {forecast && (
                      <tr className="border-t border-dashed border-border">
                        <th scope="row" className="whitespace-nowrap py-2 pr-4 font-normal">ปี {forecast.year + 543} (คาดการณ์)</th>
                        <td className="px-3 py-2 text-right tabular-nums">—</td>
                        <td className="py-2 pl-3 text-right tabular-nums">ประมาณ {number.format(forecast.value)} บาท</td>
                        <td className="py-2 pl-3 text-right text-muted-foreground">ค่าประมาณ</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  )
}
