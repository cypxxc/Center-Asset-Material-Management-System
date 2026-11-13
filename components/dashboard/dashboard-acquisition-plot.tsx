'use client'

import { useEffect, useRef, useState } from 'react'
import type { AcquisitionMetric, AcquisitionPeriod } from '@/features/reports/acquisition-series'
import { getPeriodChange, type AcquisitionForecast } from '@/features/reports/acquisition-trend'

const number = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 })

export function acquisitionValueLabel(period: AcquisitionPeriod, metric: AcquisitionMetric) {
  if (period.future) return 'ยังไม่ถึงช่วงเวลา'
  if (metric === 'count') return `${number.format(period.recordCount)} รายการ`
  if (period.recordCount > 0 && period.missingPriceCount === period.recordCount) return 'ไม่ระบุราคา'
  return `${number.format(period.knownValue)} บาท${period.missingPriceCount ? ' (เฉพาะที่ระบุราคา)' : ''}`
}

export function DashboardAcquisitionPlot({ periods, metric, forecast }: {
  periods: AcquisitionPeriod[]
  metric: AcquisitionMetric
  forecast?: AcquisitionForecast | null
}) {
  const forecastPeriod: AcquisitionPeriod | null = forecast ? {
    key: String(forecast.year), label: `${forecast.year + 543} คาดฯ`, fullLabel: `ปี ${forecast.year + 543} (คาดการณ์)`,
    recordCount: metric === 'count' ? forecast.value : 0, knownValue: metric === 'value' ? forecast.value : 0,
    missingPriceCount: 0, future: false,
  } : null
  const plotPeriods = forecastPeriod ? [...periods, forecastPeriod] : periods
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(640)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const measure = () => setContainerWidth(container.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])
  const active = plotPeriods.find(period => period.key === activeKey)
  const valueOf = (period: AcquisitionPeriod) => metric === 'count' ? period.recordCount : period.knownValue
  const maximum = Math.max(1, ...plotPeriods.filter(p => !p.future).map(valueOf))
  const step = metric === 'count' ? Math.max(1, Math.ceil(maximum / 4)) : Math.max(1, Math.ceil(maximum / 4 / 100) * 100)
  const ceiling = step * 4
  const minimumWidth = Math.max(320, plotPeriods.length * 76 + 68)
  const width = Math.max(minimumWidth, containerWidth)
  const plotHeight = 128
  const left = 54
  const plotWidth = width - left - 20
  const slot = plotWidth / plotPeriods.length
  const hasValue = (period: AcquisitionPeriod) => !period.future && !(metric === 'value' && period.recordCount > 0 && period.missingPriceCount === period.recordCount)
  const pointX = (index: number) => left + index * slot + slot / 2
  const pointY = (period: AcquisitionPeriod) => 12 + plotHeight - valueOf(period) / ceiling * plotHeight
  const linePath = periods.map((period, index) => {
    if (!hasValue(period)) return ''
    const command = index > 0 && hasValue(periods[index - 1]) ? 'L' : 'M'
    return `${command}${pointX(index)},${pointY(period)}`
  }).join(' ')
  const forecastBaselineIndex = forecast ? periods.findIndex(period => period.key === String(forecast.baselineYear)) : -1
  const forecastPath = forecastPeriod && forecastBaselineIndex >= 0
    ? `M${pointX(forecastBaselineIndex)},${pointY(periods[forecastBaselineIndex])} L${pointX(plotPeriods.length - 1)},${pointY(forecastPeriod)}` : ''

  return (
    <div>
      <div className="mb-1 text-[11px] text-muted-foreground">{metric === 'count' ? 'จำนวนรายการทะเบียน' : 'มูลค่าตามทะเบียน (บาท)'}</div>
      <div ref={containerRef} className="overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} role="region" aria-label="กราฟเส้น เลื่อนแนวนอนเพื่อดูทุกช่วงเวลา">
        <svg role="group" aria-label="กราฟทะเบียนทรัพย์สินตามวันที่ได้มา" viewBox={`0 0 ${width} 174`} width={width} height={174} style={{ minWidth: minimumWidth }} className="block text-muted-foreground">
          {[0, 1, 2, 3, 4].map(index => {
            const y = 12 + plotHeight - index * plotHeight / 4
            return <g key={index} aria-hidden="true">
              <line x1={left} x2={width - 20} y1={y} y2={y} className="stroke-border" strokeDasharray={index ? '3 5' : undefined} />
              <text x={left - 12} y={y + 4} textAnchor="end" fill="currentColor" fontSize="11">{compact.format(step * index)}</text>
            </g>
          })}
          <path d={linePath} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-primary" aria-hidden="true" />
          {forecastPath && <path d={forecastPath} fill="none" strokeWidth={1.5} strokeDasharray="5 5" className="stroke-primary/70" aria-hidden="true" />}
          {plotPeriods.map((period, index) => {
            const change = getPeriodChange(periods[index - 1], period, metric)
            const isForecast = period === forecastPeriod
            const label = `${period.fullLabel}: ${acquisitionValueLabel(period, metric)}${period.partial ? ' (ยังไม่ครบช่วงเวลา)' : ''}${!isForecast && change ? ` · ${change.label} เทียบช่วงก่อนหน้า` : ''}`
            return <g key={period.key}>
              {activeKey === period.key && hasValue(period) && <line x1={pointX(index)} x2={pointX(index)} y1={12} y2={12 + plotHeight} className="stroke-primary/30" strokeDasharray="3 4" aria-hidden="true" />}
              {hasValue(period) && <circle cx={pointX(index)} cy={pointY(period)} r={activeKey === period.key || isForecast ? 5 : 3.5} strokeWidth={2} strokeDasharray={isForecast ? '2 2' : undefined} className="fill-card stroke-primary" aria-hidden="true" />}
              <rect x={left + index * slot + 2} y={4} width={slot - 4} height={plotHeight + 25} rx={4}
                tabIndex={0} role="img" aria-label={label} className="fill-transparent outline-none focus-visible:stroke-ring focus-visible:stroke-2"
                onFocus={() => setActiveKey(period.key)} onBlur={() => setActiveKey(null)}
                onMouseEnter={() => setActiveKey(period.key)} onMouseLeave={() => setActiveKey(null)}>
                <title>{label}</title>
              </rect>
              <text x={left + index * slot + slot / 2} y={163} textAnchor="middle" fill="currentColor" fontSize="11" aria-hidden="true">{period.label}{period.partial ? '*' : ''}</text>
              {period.future && <text x={left + index * slot + slot / 2} y={128} textAnchor="middle" fill="currentColor" fontSize="13" aria-hidden="true">—</text>}
            </g>
          })}
        </svg>
      </div>
      <p className="min-h-4 text-[11px] leading-4 text-muted-foreground" aria-live="polite" aria-atomic="true">
        {active ? `${active.fullLabel}: ${acquisitionValueLabel(active, metric)}${active.partial ? ' (ยังไม่ครบช่วงเวลา)' : ''}` : '* ยังไม่ครบช่วง · เส้นประ: คาดการณ์ · — ยังไม่ถึงช่วงเวลา'}
      </p>
    </div>
  )
}
