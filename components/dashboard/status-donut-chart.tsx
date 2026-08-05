'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface StatusItemData {
  key: string
  label: string
  qty: number
  pct: number
  color: string
}

interface StatusDonutChartProps {
  totalQuantity: number
  statusData: StatusItemData[]
}

export function StatusDonutChart({ totalQuantity, statusData }: StatusDonutChartProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const activeSegments = statusData.filter((item) => item.qty > 0)
  const circ = 314.159

  const segmentDashes: Array<StatusItemData & { dashLength: number; offset: number }> = []
  let accumulatedOffset = 0
  for (const item of activeSegments) {
    const dashLength = (item.pct / 100) * circ
    segmentDashes.push({
      ...item,
      dashLength,
      offset: accumulatedOffset,
    })
    accumulatedOffset += dashLength
  }

  const activeHoverItem = statusData.find((item) => item.key === hoveredKey)

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="relative py-4 flex items-center justify-center">
        <svg viewBox="0 0 120 120" className="w-36 h-36" role="img" aria-label="กราฟแสดงสัดส่วนพัสดุตามสภาพการใช้งาน">
          {/* Background Track */}
          <circle cx="60" cy="60" r="50" fill="transparent" stroke="var(--muted, #f1f5f9)" strokeWidth="12" />

          {/* Active segments */}
          {segmentDashes.map((seg) => {
            const isHovered = hoveredKey === seg.key
            return (
              <circle
                key={seg.key}
                cx="60"
                cy="60"
                r="50"
                fill="transparent"
                stroke={seg.color}
                strokeWidth={isHovered ? 16 : 12}
                strokeDasharray={`${seg.dashLength} ${circ - seg.dashLength}`}
                strokeDashoffset={-seg.offset}
                transform="rotate(-90 60 60)"
                onMouseEnter={() => setHoveredKey(seg.key)}
                onMouseLeave={() => setHoveredKey(null)}
                className="transition-all duration-200 cursor-pointer pointer-events-stroke"
                style={{ strokeLinecap: 'butt' }}
              />
            )
          })}
        </svg>

        {/* Center Total / Hover Info */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1 text-center">
          {activeHoverItem ? (
            <>
              <span className="text-base font-black text-card-foreground leading-tight" style={{ color: activeHoverItem.color }}>
                {activeHoverItem.qty.toLocaleString()}
              </span>
              <span className="text-[9px] font-bold text-muted-foreground truncate max-w-[80px]">
                {activeHoverItem.label} ({Math.round(activeHoverItem.pct)}%)
              </span>
            </>
          ) : (
            <>
              <span className="text-xl font-black text-card-foreground">{totalQuantity.toLocaleString()}</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">ชิ้นงานรวม</span>
            </>
          )}
        </div>
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-2 mt-4 text-xs font-medium text-muted-foreground">
        {statusData.map((item) => (
          <div
            key={item.key}
            onMouseEnter={() => setHoveredKey(item.key)}
            onMouseLeave={() => setHoveredKey(null)}
            className={cn(
              "flex items-center gap-1.5 p-1 rounded-md transition-colors cursor-pointer",
              hoveredKey === item.key ? "bg-muted text-card-foreground font-semibold" : "hover:bg-muted/50"
            )}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="truncate">{item.label} ({Math.round(item.pct)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
