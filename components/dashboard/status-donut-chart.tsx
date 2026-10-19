'use client'

import { useState } from 'react'
import Link from 'next/link'
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
        <svg
          viewBox="0 0 120 120"
          className="w-36 h-36"
          role="img"
          aria-label="กราฟแสดงสัดส่วนพัสดุตามสภาพการใช้งาน"
        >
          {/* Background Track */}
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="transparent"
            stroke="var(--muted, #f1f5f9)"
            strokeWidth="14"
          />

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
                strokeWidth={isHovered ? 18 : 14}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
          {activeHoverItem ? (
            <>
              <span className="text-xs font-semibold text-card-foreground truncate max-w-[80px]">
                {activeHoverItem.label}
              </span>
              <span className="text-sm font-bold tabular-nums text-card-foreground">
                {activeHoverItem.qty.toLocaleString()} ชิ้น
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                ({activeHoverItem.pct.toFixed(1)}%)
              </span>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground font-medium">ทั้งหมด</span>
              <span className="text-sm font-bold tabular-nums text-card-foreground">
                {totalQuantity.toLocaleString()} ชิ้น
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-2 mt-4 text-xs font-medium text-muted-foreground">
        {statusData.map((item) => (
          <Link
            key={item.key}
            href={`/items?status=${item.key}`}
            title={`ดูรายการพัสดุสถานะ ${item.label}`}
            onMouseEnter={() => setHoveredKey(item.key)}
            onMouseLeave={() => setHoveredKey(null)}
            className={cn(
              "group flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-muted/60 transition-colors",
              hoveredKey === item.key ? "bg-muted text-card-foreground font-semibold" : "text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="truncate group-hover:text-card-foreground transition-colors">
                {item.label}
              </span>
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground shrink-0 font-medium ml-1">
              ({Math.round(item.pct)}%)
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
