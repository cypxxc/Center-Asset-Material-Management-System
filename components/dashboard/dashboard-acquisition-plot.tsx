'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AcquisitionMetric, AcquisitionPeriod } from '@/features/reports/acquisition-series'
import { getPeriodChange, type AcquisitionForecast } from '@/features/reports/acquisition-trend'
import { cn } from '@/lib/utils'
import { DashboardChartTooltip } from './dashboard-chart-tooltip'

const number = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 })

export type ValueTier = 'Low' | 'Medium' | 'Peak'

export const ASSET_COLORS = {
  low: '#16A34A',
  medium: '#EAB308',
  peak: '#DC2626',
} as const

export const MATERIAL_COLORS = {
  low: '#38BDF8',
  medium: '#EC4899',
  peak: '#7C3AED',
} as const

export function acquisitionValueLabel(period: AcquisitionPeriod, metric: AcquisitionMetric) {
  if (period.future) return 'ยังไม่ถึงช่วงเวลา'
  if (metric === 'count') return `${number.format(period.recordCount)} รายการ`
  if (period.recordCount > 0 && period.missingPriceCount === period.recordCount) return 'ไม่ระบุราคา'
  return `${number.format(period.knownValue)} บาท${period.missingPriceCount ? ' (เฉพาะที่ระบุราคา)' : ''}`
}

function getYoYBadge(prev: AcquisitionPeriod | undefined, curr: AcquisitionPeriod, metric: AcquisitionMetric) {
  if (!prev || prev.future || curr.future) return null
  if (prev.recordCount === 0 || curr.recordCount === 0) return null
  const prevVal = metric === 'count' ? prev.recordCount : prev.knownValue
  const currVal = metric === 'count' ? curr.recordCount : curr.knownValue

  if (prevVal === 0) {
    if (currVal === 0) return { text: '→ 0%', type: 'flat' as const }
    return null
  }

  const diff = currVal - prevVal
  if (diff === 0) return { text: '→ 0%', type: 'flat' as const }

  const percent = (diff / prevVal) * 100
  const formatted = Math.abs(percent) < 0.1 ? '<0.1' : Math.abs(percent).toLocaleString('th-TH', { maximumFractionDigits: 1 })

  return diff > 0
    ? { text: `↑ +${formatted}%`, type: 'up' as const }
    : { text: `↓ -${formatted}%`, type: 'down' as const }
}

export function DashboardAcquisitionPlot({
  periods,
  metric,
  forecast,
  title = 'ทะเบียนครุภัณฑ์',
  dateBasis = 'วันที่ได้มา',
  showLegend = true,
  chartType = 'line',
  itemType,
}: {
  periods: AcquisitionPeriod[]
  metric: AcquisitionMetric
  forecast?: AcquisitionForecast | null
  title?: string
  dateBasis?: string
  showLegend?: boolean
  chartType?: 'line' | 'bar'
  itemType?: 'asset' | 'material'
}) {
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

  const valueOf = (period: AcquisitionPeriod) => metric === 'count' ? period.recordCount : period.knownValue
  const isBar = chartType === 'bar'
  const isMaterial = itemType === 'material' || chartType === 'bar'

  const hasValue = (period: AcquisitionPeriod) => !period.future && !(metric === 'value' && period.recordCount > 0 && period.missingPriceCount === period.recordCount)

  // Min-Max Normalization จากมูลค่าจริง คำนวณใหม่ตามช่วงข้อมูลที่เลือก
  const tiers = useMemo(() => {
    const tierMap = new Map<string, ValueTier>()
    // ปีไม่มีข้อมูลไม่ต้องนำมาคำนวณ
    const activeDataPeriods = periods.filter(p => !p.future && (isBar ? p.recordCount > 0 : hasValue(p)) && p.knownValue > 0)
    if (activeDataPeriods.length === 0) return tierMap

    const values = activeDataPeriods.map(p => p.knownValue)
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)

    for (const p of activeDataPeriods) {
      if (maxVal === minVal) {
        // ถ้าทุกค่าเท่ากันให้เป็น Medium
        tierMap.set(p.key, 'Medium')
      } else {
        const ratio = (p.knownValue - minVal) / (maxVal - minVal)
        if (ratio <= 0.3333333333) {
          tierMap.set(p.key, 'Low')
        } else if (ratio <= 0.6666666667) {
          tierMap.set(p.key, 'Medium')
        } else {
          tierMap.set(p.key, 'Peak')
        }
      }
    }
    return tierMap
  }, [periods, isBar])

  const getTierColor = (tier: ValueTier | undefined) => {
    const palette = isMaterial ? MATERIAL_COLORS : ASSET_COLORS
    if (tier === 'Low') return palette.low
    if (tier === 'Medium') return palette.medium
    if (tier === 'Peak') return palette.peak
    return isMaterial ? '#94A3B8' : '#3B82F6'
  }

  const forecastPeriod: AcquisitionPeriod | null = (!isBar && forecast) ? {
    key: String(forecast.year), label: `${forecast.year + 543} คาดฯ`, fullLabel: `ปี ${forecast.year + 543} (คาดการณ์)`,
    recordCount: metric === 'count' ? forecast.value : 0, knownValue: metric === 'value' ? forecast.value : 0,
    missingPriceCount: 0, future: false,
  } : null
  const plotPeriods = forecastPeriod ? [...periods, forecastPeriod] : periods

  const validPeriods = plotPeriods.filter(p => !p.future && (isBar ? p.recordCount > 0 : true))
  const maximum = Math.max(1, ...validPeriods.map(valueOf))
  const step = metric === 'count' ? Math.max(1, Math.ceil(maximum / 4)) : Math.max(1, Math.ceil(maximum / 4 / 100) * 100)
  const ceiling = step * 4
  const width = Math.max(280, containerWidth)
  const plotHeight = 128
  const left = 44
  const right = 16
  const plotWidth = Math.max(100, width - left - right)
  const slot = plotPeriods.length > 0 ? plotWidth / plotPeriods.length : plotWidth
  const barWidth = Math.min(26, Math.max(10, slot * 0.52))

  const pointX = (index: number) => left + index * slot + slot / 2
  const pointY = (period: AcquisitionPeriod) => 12 + plotHeight - (valueOf(period) / ceiling) * plotHeight

  const forecastBaselineIndex = forecast ? periods.findIndex(period => period.key === String(forecast.baselineYear)) : -1
  const forecastPath = forecastPeriod && forecastBaselineIndex >= 0
    ? `M${pointX(forecastBaselineIndex)},${pointY(periods[forecastBaselineIndex])} L${pointX(plotPeriods.length - 1)},${pointY(forecastPeriod)}` : ''

  const activeIndex = plotPeriods.findIndex(p => p.key === activeKey)
  const active = activeIndex >= 0 ? plotPeriods[activeIndex] : null
  const isForecastActive = active !== null && active === forecastPeriod

  const activeX = activeIndex >= 0 ? pointX(activeIndex) : 0
  const activeY = active
    ? (isBar
        ? (12 + plotHeight - (valueOf(active) > 0 ? Math.max(4, (valueOf(active) / ceiling) * plotHeight) : 0))
        : pointY(active))
    : undefined

  let tooltipTitle = ''
  let tooltipValue: string | undefined
  let tooltipUnit: string | undefined
  let tooltipBadge: { text: string; type: 'up' | 'down' | 'flat' | 'neutral' } | null = null
  let tooltipItems: Array<{ label: string; value: string | number; unit?: string; colorClass?: string }> | undefined
  let tooltipNote: string | undefined

  if (active) {
    tooltipTitle = isForecastActive
      ? `ปี ${forecast!.year + 543} (คาดการณ์)`
      : `${active.fullLabel}${active.partial ? ' (ยังไม่ครบช่วง)' : ''}`

    const prevPeriod = activeIndex > 0 ? plotPeriods[activeIndex - 1] : undefined
    const badge = prevPeriod && !active.future && !prevPeriod.future ? getYoYBadge(prevPeriod, active, metric) : null
    if (badge) {
      tooltipBadge = badge
    } else if (isForecastActive) {
      tooltipBadge = { text: 'คาดการณ์', type: 'neutral' }
    }

    const activeTier = tiers.get(active.key)
    const tierColorClass = isMaterial
      ? (activeTier === 'Low' ? 'bg-[#38BDF8]' : activeTier === 'Medium' ? 'bg-[#EC4899]' : 'bg-[#7C3AED]')
      : (activeTier === 'Low' ? 'bg-[#16A34A]' : activeTier === 'Medium' ? 'bg-[#EAB308]' : 'bg-[#DC2626]')

    if (active.future) {
      tooltipValue = 'ยังไม่ถึงช่วงเวลา'
    } else if (active.recordCount === 0) {
      tooltipValue = 'ไม่มีข้อมูล'
    } else if (metric === 'count') {
      tooltipValue = number.format(active.recordCount)
      tooltipUnit = 'รายการ'
      tooltipItems = [
        ...(active.knownValue > 0 ? [{ label: 'มูลค่ารวม', value: number.format(active.knownValue), unit: 'บาท' }] : []),
        ...(activeTier ? [{ label: 'ระดับมูลค่า', value: activeTier, colorClass: tierColorClass }] : []),
      ]
    } else if (active.recordCount > 0 && active.missingPriceCount === active.recordCount) {
      tooltipValue = 'ไม่ระบุราคา'
      tooltipItems = [
        { label: 'จำนวน', value: number.format(active.recordCount), unit: 'รายการ' },
        ...(activeTier ? [{ label: 'ระดับมูลค่า', value: activeTier, colorClass: tierColorClass }] : []),
      ]
    } else {
      tooltipValue = number.format(active.knownValue)
      tooltipUnit = 'บาท'
      tooltipItems = [
        { label: 'จำนวนรายการ', value: number.format(active.recordCount), unit: 'รายการ' },
        ...(activeTier ? [{ label: 'ระดับมูลค่า', value: activeTier, colorClass: tierColorClass }] : []),
      ]
      if (active.missingPriceCount > 0) {
        tooltipNote = `ไม่ระบุราคา ${number.format(active.missingPriceCount)} รายการ`
      }
    }
  }

  return (
    <div>
      <div className="mb-1 text-[11px] text-muted-foreground">{metric === 'count' ? 'จำนวนรายการทะเบียน' : 'มูลค่าตามทะเบียน (บาท)'}</div>
      <div ref={containerRef} className="relative w-full overflow-hidden rounded-md focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} role="region" aria-label={`กราฟ${isBar ? 'แท่ง' : 'เส้น'}${title}`}>
        <svg role="group" aria-label={`กราฟ${isBar ? 'แท่ง' : ''}${title}ตาม${dateBasis}`} viewBox={`0 0 ${width} 174`} width="100%" height={174} className="block w-full text-muted-foreground">
          {[0, 1, 2, 3, 4].map(index => {
            const y = 12 + plotHeight - (index * plotHeight) / 4
            return (
              <g key={index} aria-hidden="true">
                <line x1={left} x2={width - right} y1={y} y2={y} className="stroke-border/50 dark:stroke-border/40" strokeDasharray={index ? '3 5' : undefined} />
                <text x={left - 10} y={y + 4} textAnchor="end" fill="currentColor" fontSize="11">{compact.format(step * index)}</text>
              </g>
            )
          })}

          {!isBar && (
            <>
              {periods.slice(1).map((period, i) => {
                const index = i + 1
                const prev = periods[index - 1]
                if (!hasValue(prev) || !hasValue(period)) return null
                // กราฟเส้นใช้สีแต่ละช่วงตามระดับของจุดปลายทาง
                const destTier = tiers.get(period.key)
                const strokeColor = getTierColor(destTier)
                return (
                  <line
                    key={`segment-${prev.key}-${period.key}`}
                    x1={pointX(index - 1)}
                    y1={pointY(prev)}
                    x2={pointX(index)}
                    y2={pointY(period)}
                    stroke={strokeColor}
                    strokeWidth={2}
                    strokeLinecap="round"
                    aria-hidden="true"
                  />
                )
              })}
              {forecastPath && <path d={forecastPath} fill="none" strokeWidth={1.5} strokeDasharray="4 4" className="stroke-blue-500/60 dark:stroke-blue-400/50" aria-hidden="true" />}
            </>
          )}

          {/* YoY Badges between periods */}
          {periods.slice(1).map((period, i) => {
            const index = i + 1
            const prev = periods[index - 1]
            if (isBar ? (!prev || prev.recordCount === 0 || period.recordCount === 0) : (!hasValue(prev) || !hasValue(period))) return null
            const badge = getYoYBadge(prev, period, metric)
            if (!badge) return null
            const midX = isBar ? pointX(index) : left + index * slot
            const val = valueOf(period)
            const barH = val > 0 ? Math.max(4, (val / ceiling) * plotHeight) : 0
            const barY = 12 + plotHeight - barH
            const lineYAtMid = (pointY(prev) + pointY(period)) / 2
            const textY = isBar ? Math.max(14, (val > 0 ? barY : 12 + plotHeight) - 6) : (lineYAtMid > 30 ? lineYAtMid - 10 : lineYAtMid + 16)
            return (
              <text
                key={`yoy-${period.key}`}
                x={midX}
                y={textY}
                textAnchor="middle"
                fontSize={isBar ? '9' : '10'}
                className={badge.type === 'up' ? 'fill-emerald-600 dark:fill-emerald-400 font-semibold' : badge.type === 'down' ? 'fill-rose-600 dark:fill-rose-400 font-semibold' : 'fill-muted-foreground font-medium'}
                aria-hidden="true"
              >
                {badge.text}
              </text>
            )
          })}

          {/* Plot items */}
          {plotPeriods.map((period, index) => {
            const hasData = isBar ? (!period.future && period.recordCount > 0) : hasValue(period)
            const val = valueOf(period)
            const isForecast = period === forecastPeriod
            const centerX = pointX(index)
            const barX = centerX - barWidth / 2
            const barH = val > 0 ? Math.max(4, (val / ceiling) * plotHeight) : 0
            const barY = 12 + plotHeight - barH
            const change = getPeriodChange(periods[index - 1], period, metric)

            const label = isBar
              ? (period.future
                ? `${period.fullLabel}: ยังไม่ถึงช่วงเวลา`
                : !hasData
                  ? `${period.fullLabel}: ไม่มีข้อมูล`
                  : val === 0
                    ? `${period.fullLabel}: 0.00 บาท (${number.format(period.recordCount)} รายการ) · มีข้อมูลแต่ยอด 0 บาท`
                    : `${period.fullLabel}: ${number.format(val)} บาท (${number.format(period.recordCount)} รายการ)`)
              : `${period.fullLabel}: ${acquisitionValueLabel(period, metric)}${period.partial ? ' (ยังไม่ครบช่วงเวลา)' : ''}${!isForecast && change ? ` · ${change.label} เทียบช่วงก่อนหน้า` : ''}`

            return (
              <g key={period.key}>
                {isBar && hasData && (
                  val > 0 ? (
                    <rect
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={barH}
                      rx={2.5}
                      fill={getTierColor(tiers.get(period.key))}
                      className={cn(
                        'transition-opacity duration-150',
                        activeKey === period.key ? 'opacity-100 ring-2 ring-foreground/20' : 'opacity-90 hover:opacity-100'
                      )}
                      aria-hidden="true"
                    />
                  ) : (
                    <rect x={barX} y={12 + plotHeight - 2} width={barWidth} height={2} rx={1} className="fill-muted-foreground/40" aria-hidden="true" />
                  )
                )}

                {!isBar && (
                  <>
                    {activeKey === period.key && hasValue(period) && <line x1={centerX} x2={centerX} y1={12} y2={12 + plotHeight} className="stroke-border" strokeDasharray="3 4" aria-hidden="true" />}
                    {hasValue(period) && (
                      <circle
                        cx={centerX}
                        cy={pointY(period)}
                        r={activeKey === period.key || isForecast ? 4.5 : 3}
                        strokeWidth={2}
                        strokeDasharray={isForecast ? '2 2' : undefined}
                        stroke={getTierColor(tiers.get(period.key))}
                        className="fill-background"
                        aria-hidden="true"
                      />
                    )}
                  </>
                )}

                {/* Hit target */}
                <rect
                  x={left + index * slot + (isBar ? 1 : 2)}
                  y={4}
                  width={Math.max(1, slot - (isBar ? 2 : 4))}
                  height={plotHeight + 25}
                  rx={4}
                  tabIndex={0}
                  role="img"
                  aria-label={label}
                  className={cn(
                    'fill-transparent outline-none cursor-pointer focus-visible:stroke-ring focus-visible:stroke-2',
                    isBar && activeKey === period.key && 'fill-muted/40 dark:fill-muted/20'
                  )}
                  onFocus={() => setActiveKey(period.key)}
                  onBlur={() => setActiveKey(null)}
                  onMouseEnter={() => setActiveKey(period.key)}
                  onMouseLeave={() => setActiveKey(null)}
                />

                <text
                  x={centerX}
                  y={163}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="11"
                  className="font-normal text-muted-foreground"
                  aria-hidden="true"
                >
                  {period.label}{!isBar && period.partial && showLegend ? '*' : ''}
                </text>

                {period.future && (
                  <text x={centerX} y={128} textAnchor="middle" fill="currentColor" fontSize="13" aria-hidden="true">—</text>
                )}
              </g>
            )
          })}
        </svg>

        {active && (
          <DashboardChartTooltip
            title={tooltipTitle}
            value={tooltipValue}
            unit={tooltipUnit}
            badge={tooltipBadge}
            items={tooltipItems}
            note={tooltipNote}
            x={activeX}
            y={activeY}
            containerWidth={width}
            containerHeight={174}
          />
        )}
      </div>

      <p className="min-h-4 text-[11px] leading-4 text-muted-foreground" aria-live="polite" aria-atomic="true">
        {isBar ? (
          active ? (
            active.future
              ? `${active.fullLabel}: ยังไม่ถึงช่วงเวลา`
              : active.recordCount === 0
                ? `${active.fullLabel}: ไม่มีข้อมูล`
                : active.knownValue === 0
                  ? `${active.fullLabel}: 0.00 บาท (${number.format(active.recordCount)} รายการ)`
                  : `${active.fullLabel}: ${acquisitionValueLabel(active, metric)}${active.partial ? ' (ยังไม่ครบช่วงเวลา)' : ''}`
          ) : 'วางเมาส์หรือแตะที่แท่งข้อมูลเพื่อดูรายละเอียดรายเดือน'
        ) : (
          active
            ? `${active.fullLabel}: ${acquisitionValueLabel(active, metric)}${active.partial ? ' (ยังไม่ครบช่วงเวลา)' : ''}`
            : showLegend ? '* ยังไม่ครบช่วง · เส้นประ: คาดการณ์ · — ยังไม่ถึงช่วงเวลา' : null
        )}
      </p>

      {/* Legend แสดงความหมายสีแยกตามกราฟ */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-foreground text-[10.5px]">ระดับมูลค่า:</span>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: isMaterial ? MATERIAL_COLORS.low : ASSET_COLORS.low }} />
            <span>Low (0–33%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: isMaterial ? MATERIAL_COLORS.medium : ASSET_COLORS.medium }} />
            <span>Medium (33–67%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: isMaterial ? MATERIAL_COLORS.peak : ASSET_COLORS.peak }} />
            <span>Peak (67–100%)</span>
          </div>
        </div>
        {!isBar && (
          <span className="text-[10px] text-muted-foreground/80">
            * สีช่วงเส้นอิงตามระดับของจุดปลายทาง
          </span>
        )}
      </div>
    </div>
  )
}

