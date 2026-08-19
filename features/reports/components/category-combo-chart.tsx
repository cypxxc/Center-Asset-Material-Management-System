'use client'

import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboCategoryItem {
  category: string
  totalQty: number
  activeQty: number
}

// Aliases for compatibility
export type RadarCategoryItem = ComboCategoryItem
export type CategoryComboItem = ComboCategoryItem

export interface CategoryComboChartProps {
  data: ComboCategoryItem[]
  totalValue?: number
  totalCount?: number
  activeCount?: number
  className?: string
}

export function CategoryComboChart({
  data,
  totalValue,
  totalCount,
  activeCount,
  className,
}: CategoryComboChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Filter out invalid items
  const validData = (data || []).filter((d) => d && typeof d.category === 'string')

  const hasKpis = totalValue !== undefined || totalCount !== undefined || activeCount !== undefined
  const safeTotalCount = totalCount ?? 0
  const safeActiveCount = activeCount ?? 0
  const activeRatePct = safeTotalCount > 0 ? Math.round((safeActiveCount / safeTotalCount) * 100) : 100
  const formattedTotalValue = (totalValue ?? 0).toLocaleString('th-TH')

  if (validData.length === 0) {
    return (
      <div
        className={cn(
          'bg-card text-card-foreground p-6 rounded-xl border border-border shadow-xs print:hidden',
          className
        )}
        data-testid="category-combo-chart-card"
      >
        {hasKpis && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 mb-6 border-b border-border">
            {/* Metric 1: Total Valuation */}
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                มูลค่าทรัพย์สินทั้งหมด (Total Valuation)
              </p>
              <h3 className="text-2xl font-bold text-card-foreground mt-1">
                {formattedTotalValue} บาท
              </h3>
              <p className="text-xs text-muted-foreground mt-1">คำนวณจากราคาต่อหน่วยที่บันทึกในทะเบียน</p>
            </div>

            {/* Metric 2: Active Rate */}
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                สัดส่วนพัสดุพร้อมใช้งาน (Active Rate)
              </p>
              <div className="flex items-center justify-between mt-1">
                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {activeRatePct}%
                </h3>
                <span className="text-xs text-muted-foreground font-bold">
                  {safeActiveCount.toLocaleString('th-TH')} / {safeTotalCount.toLocaleString('th-TH')} รายการ
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${activeRatePct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">พัสดุที่อยู่ในสถานะใช้งานปกติพร้อมปฏิบัติงาน</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-sm text-card-foreground">
            แผนภูมิแท่งและแนวโน้มเปรียบเทียบสัดส่วนตามหมวดหมู่ (Category Combo Chart)
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">ไม่มีข้อมูลหมวดหมู่สำหรับแสดงผลแผนภูมิในขณะนี้</p>
      </div>
    )
  }

  // Calculate totals
  const overallTotal = validData.reduce((sum, d) => sum + (d.totalQty || 0), 0)
  const overallActive = validData.reduce((sum, d) => sum + (d.activeQty || 0), 0)

  // Chart dimensions
  const svgWidth = 600
  const svgHeight = 320
  const paddingLeft = 48
  const paddingRight = 48
  const paddingTop = 28
  const paddingBottom = 54

  const plotWidth = svgWidth - paddingLeft - paddingRight
  const plotHeight = svgHeight - paddingTop - paddingBottom
  const plotBottom = svgHeight - paddingBottom
  const plotTop = paddingTop
  const plotLeft = paddingLeft
  const plotRight = svgWidth - paddingRight

  // Calculate nice Y max for quantities
  const rawMax = Math.max(...validData.map((d) => Math.max(d.totalQty || 0, d.activeQty || 0)), 1)
  const getNiceMax = (val: number) => {
    if (val <= 4) return 4
    if (val <= 8) return 8
    if (val <= 12) return 12
    if (val <= 20) return 20
    if (val <= 50) return Math.ceil(val / 10) * 10
    if (val <= 100) return Math.ceil(val / 20) * 20
    if (val <= 500) return Math.ceil(val / 50) * 50
    if (val <= 1000) return Math.ceil(val / 100) * 100
    const factor = Math.pow(10, Math.floor(Math.log10(val)))
    return Math.ceil(val / factor) * factor
  }
  const yMax = getNiceMax(rawMax)

  // Y-axis grid levels (0%, 25%, 50%, 75%, 100%)
  const gridLevels = [0, 0.25, 0.5, 0.75, 1.0]

  const count = validData.length
  const slotWidth = plotWidth / count

  // Calculate coordinates for bars, line, and labels
  const categoriesRenderData = validData.map((item, index) => {
    const slotX = plotLeft + index * slotWidth
    const slotCenter = slotX + slotWidth / 2

    const maxBarWidth = Math.min(22, Math.max(6, (slotWidth - 14) / 2))
    const barGap = 2
    const totalBarWidth = maxBarWidth
    const activeBarWidth = maxBarWidth

    const totalQty = item.totalQty || 0
    const activeQty = item.activeQty || 0

    const totalH = Math.max(0, (totalQty / yMax) * plotHeight)
    const activeH = Math.max(0, (activeQty / yMax) * plotHeight)

    const totalX = slotCenter - totalBarWidth - barGap / 2
    const totalY = plotBottom - totalH

    const activeX = slotCenter + barGap / 2
    const activeY = plotBottom - activeH

    const usabilityRate = totalQty > 0 ? (activeQty / totalQty) * 100 : 0
    const clampedRate = Math.min(100, Math.max(0, usabilityRate))
    const lineY = plotBottom - (clampedRate / 100) * plotHeight
    const lineX = slotCenter

    return {
      index,
      category: item.category,
      totalQty,
      activeQty,
      usabilityRate,
      slotX,
      slotWidth,
      slotCenter,
      totalX,
      totalY,
      totalH,
      totalBarWidth,
      activeX,
      activeY,
      activeH,
      activeBarWidth,
      lineX,
      lineY,
    }
  })

  // Polyline points for Usability Trend Line
  const linePointsString = categoriesRenderData.map((d) => `${d.lineX},${d.lineY}`).join(' ')

  const hoveredItem = hoveredIndex !== null ? categoriesRenderData[hoveredIndex] : null

  return (
    <div
      className={cn(
        'bg-card text-card-foreground p-6 rounded-xl border border-border shadow-xs print:hidden',
        className
      )}
      data-testid="category-combo-chart-card"
    >
      {/* Top KPI Strip */}
      {hasKpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 mb-6 border-b border-border">
          {/* Metric 1: Total Valuation */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              มูลค่าทรัพย์สินทั้งหมด (Total Valuation)
            </p>
            <h3 className="text-2xl font-bold text-card-foreground mt-1">
              {formattedTotalValue} บาท
            </h3>
            <p className="text-xs text-muted-foreground mt-1">คำนวณจากราคาต่อหน่วยที่บันทึกในทะเบียน</p>
          </div>

          {/* Metric 2: Active Rate */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              สัดส่วนพัสดุพร้อมใช้งาน (Active Rate)
            </p>
            <div className="flex items-center justify-between mt-1">
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {activeRatePct}%
              </h3>
              <span className="text-xs text-muted-foreground font-bold">
                {safeActiveCount.toLocaleString('th-TH')} / {safeTotalCount.toLocaleString('th-TH')} รายการ
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${activeRatePct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">พัสดุที่อยู่ในสถานะใช้งานปกติพร้อมปฏิบัติงาน</p>
          </div>
        </div>
      )}

      {/* Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-card-foreground">
              แผนภูมิแท่งและแนวโน้มเปรียบเทียบสัดส่วนตามหมวดหมู่ (Category Combo Chart)
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            เปรียบเทียบปริมาณทั้งหมด ปริมาณพร้อมใช้งาน และอัตราความพร้อมใช้งานในแต่ละหมวดหมู่
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-blue-500 inline-block" />
            <span className="font-semibold text-card-foreground">
              จำนวนทั้งหมด: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{overallTotal.toLocaleString('th-TH')}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
            <span className="font-semibold text-card-foreground">
              พร้อมใช้งาน: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{overallActive.toLocaleString('th-TH')}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 bg-amber-500 inline-block relative">
              <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </span>
            <span className="font-semibold text-card-foreground">
              อัตราความพร้อมใช้งาน (% Usability)
            </span>
          </div>
        </div>
      </div>

      {/* Chart Layout: Grid with SVG & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-4">
        {/* Combo Chart SVG Visualizer */}
        <div className="lg:col-span-8 flex items-center justify-center relative">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full max-w-full h-auto overflow-visible select-none"
            role="img"
            aria-label="แผนภูมิแท่งและแนวโน้มเปรียบเทียบสัดส่วนพัสดุตามหมวดหมู่"
          >
            {/* Horizontal Grid Lines and Y-Axis Ticks */}
            {gridLevels.map((level) => {
              const yVal = plotBottom - level * plotHeight
              const qtyTick = Math.round(yMax * level)
              const pctTick = Math.round(level * 100)

              return (
                <g key={`grid-lvl-${level}`}>
                  {/* Grid Line */}
                  <line
                    x1={plotLeft}
                    y1={yVal}
                    x2={plotRight}
                    y2={yVal}
                    className={cn(
                      level === 0 ? 'stroke-border stroke-1' : 'stroke-border/60 dark:stroke-border/40 stroke-1'
                    )}
                    strokeDasharray={level === 0 ? undefined : '3 3'}
                  />

                  {/* Left Y-axis Label: Quantity */}
                  <text
                    x={plotLeft - 8}
                    y={yVal + 3}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px] font-mono select-none"
                  >
                    {qtyTick}
                  </text>

                  {/* Right Y-axis Label: Usability Rate % */}
                  <text
                    x={plotRight + 8}
                    y={yVal + 3}
                    textAnchor="start"
                    className="fill-amber-600 dark:fill-amber-400 text-[10px] font-mono font-medium select-none"
                  >
                    {pctTick}%
                  </text>
                </g>
              )
            })}

            {/* Hover Column Highlights */}
            {categoriesRenderData.map((d) => {
              const isHovered = hoveredIndex === d.index
              if (!isHovered) return null
              return (
                <rect
                  key={`hover-col-${d.index}`}
                  x={d.slotX}
                  y={plotTop}
                  width={d.slotWidth}
                  height={plotHeight}
                  className="fill-muted/40 transition-opacity duration-150 pointer-events-none rounded-md"
                />
              )
            })}

            {/* Category Bars: Total Quantity (Primary Blue) & Active Quantity (Emerald Green) */}
            {categoriesRenderData.map((d) => {
              const isHovered = hoveredIndex === d.index

              return (
                <g
                  key={`bars-${d.index}`}
                  onMouseEnter={() => setHoveredIndex(d.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="cursor-pointer"
                >
                  {/* Total Quantity Bar (Blue) */}
                  <rect
                    x={d.totalX}
                    y={d.totalY}
                    width={d.totalBarWidth}
                    height={d.totalH}
                    rx="3"
                    className={cn(
                      'transition-all duration-200',
                      isHovered
                        ? 'fill-blue-600 drop-shadow-sm'
                        : 'fill-blue-500 hover:fill-blue-600'
                    )}
                  >
                    <title>{`${d.category} - ทั้งหมด: ${d.totalQty} ชิ้น`}</title>
                  </rect>

                  {/* Active Quantity Bar (Emerald) */}
                  <rect
                    x={d.activeX}
                    y={d.activeY}
                    width={d.activeBarWidth}
                    height={d.activeH}
                    rx="3"
                    className={cn(
                      'transition-all duration-200',
                      isHovered
                        ? 'fill-emerald-600 drop-shadow-sm'
                        : 'fill-emerald-500 hover:fill-emerald-600'
                    )}
                  >
                    <title>{`${d.category} - พร้อมใช้งาน: ${d.activeQty} ชิ้น`}</title>
                  </rect>
                </g>
              )
            })}

            {/* Usability Trend Line (Amber / Violet) */}
            <polyline
              points={linePointsString}
              fill="none"
              className="stroke-amber-500 dark:stroke-amber-400 transition-all duration-200 pointer-events-none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Usability Trend Dots */}
            {categoriesRenderData.map((d) => {
              const isHovered = hoveredIndex === d.index

              return (
                <g
                  key={`dot-group-${d.index}`}
                  onMouseEnter={() => setHoveredIndex(d.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={d.lineX}
                    cy={d.lineY}
                    r={isHovered ? 6 : 4}
                    className={cn(
                      'fill-amber-500 dark:fill-amber-400 stroke-card stroke-2 transition-all duration-200',
                      isHovered && 'stroke-primary stroke-[2.5]'
                    )}
                  >
                    <title>{`${d.category} - ความพร้อมใช้งาน: ${Math.round(d.usabilityRate)}%`}</title>
                  </circle>
                </g>
              )
            })}

            {/* X-Axis Category Labels */}
            {categoriesRenderData.map((d) => {
              const isHovered = hoveredIndex === d.index
              const maxLabelLen = count > 5 ? 10 : 14
              const displayLabel =
                d.category.length > maxLabelLen
                  ? d.category.slice(0, maxLabelLen - 1) + '…'
                  : d.category

              return (
                <text
                  key={`x-label-${d.index}`}
                  x={d.slotCenter}
                  y={plotBottom + 18}
                  textAnchor="middle"
                  className={cn(
                    'text-[11px] transition-colors duration-200 cursor-pointer select-none',
                    isHovered
                      ? 'fill-primary font-bold'
                      : 'fill-card-foreground font-medium'
                  )}
                  onMouseEnter={() => setHoveredIndex(d.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {displayLabel}
                  <title>{d.category}</title>
                </text>
              )
            })}

            {/* Tooltip Overlay Badge when Hovered */}
            {hoveredItem && (
              <g
                transform={`translate(${Math.min(
                  Math.max(hoveredItem.slotCenter - 65, plotLeft),
                  plotRight - 130
                )}, ${Math.max(plotTop - 18, 2)})`}
                className="pointer-events-none transition-all duration-150"
              >
                <rect
                  width="130"
                  height="22"
                  rx="4"
                  className="fill-popover stroke-border stroke-1 drop-shadow-sm"
                />
                <text
                  x="65"
                  y="14"
                  textAnchor="middle"
                  className="fill-popover-foreground text-[10px] font-semibold"
                >
                  {`พร้อมใช้ ${hoveredItem.activeQty}/${hoveredItem.totalQty} (${Math.round(
                    hoveredItem.usabilityRate
                  )}%)`}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Category Breakdown Details List */}
        <div className="lg:col-span-4 flex flex-col justify-center space-y-2.5">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>รายละเอียดแต่ละหมวดหมู่</span>
            <span className="text-[11px] text-muted-foreground/80 font-normal">
              {hoveredIndex !== null ? 'กำลังเลือกดู' : 'ชี้เพื่อดูเจาะจง'}
            </span>
          </div>

          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {validData.map((item, idx) => {
              const isHovered = hoveredIndex === idx
              const total = item.totalQty || 0
              const active = item.activeQty || 0
              const activePct = total > 0 ? Math.round((active / total) * 100) : 0

              return (
                <div
                  key={item.category}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={cn(
                    'p-2.5 rounded-lg border transition-all duration-200 cursor-pointer text-xs',
                    isHovered
                      ? 'bg-muted border-primary shadow-xs'
                      : 'bg-card/50 border-border/70 hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-card-foreground truncate max-w-[130px]">
                      {item.category}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{active}</span> /{' '}
                      <span className="font-bold text-blue-600 dark:text-blue-400">{total}</span> ชิ้น ({activePct}%)
                    </span>
                  </div>

                  {/* Dual comparison bar */}
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${activePct}%` }}
                      title={`พร้อมใช้งาน ${active} ชิ้น`}
                    />
                    <div
                      className="bg-blue-400/40 h-full transition-all duration-300"
                      style={{ width: `${100 - activePct}%` }}
                      title={`อื่นๆ ${Math.max(0, total - active)} ชิ้น`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// Alias export for backward compatibility
export const CategoryRadarChart = CategoryComboChart
