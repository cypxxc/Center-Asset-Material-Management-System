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
      <div className="relative py-2 flex items-center justify-center">
        <svg
          viewBox="0 0 120 120"
          className="w-32 h-32 sm:w-36 sm:h-36 drop-shadow-2xs"
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
            strokeWidth="12"
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
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
          {activeHoverItem ? (
            <>
              <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[84px] tracking-tight">
                {activeHoverItem.label}
              </span>
              <span className="text-base font-bold tabular-nums tracking-tight text-card-foreground font-mono">
                {activeHoverItem.qty.toLocaleString()} ชิ้น
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums font-mono">
                ({activeHoverItem.pct.toFixed(1)}%)
              </span>
            </>
          ) : (
            <>
              <span className="text-[11px] text-muted-foreground font-medium tracking-tight">ทั้งหมด</span>
              <span className="text-base font-bold tabular-nums tracking-tight text-card-foreground font-mono">
                {totalQuantity.toLocaleString()} ชิ้น
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/40 text-xs font-medium">
        {statusData.map((item) => (
          <Link
            key={item.key}
            href={`/items?status=${item.key}`}
            title={`ดูรายการพัสดุสถานะ ${item.label}`}
            onMouseEnter={() => setHoveredKey(item.key)}
            onMouseLeave={() => setHoveredKey(null)}
            className={cn(
              "group flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border transition-all duration-150",
              hoveredKey === item.key
                ? "bg-muted/80 border-border text-card-foreground font-semibold shadow-2xs"
                : "border-border/40 hover:border-border/80 hover:bg-muted/40 text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0 ring-1 ring-background"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="truncate group-hover:text-card-foreground transition-colors">
                {item.label}
              </span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground group-hover:text-card-foreground shrink-0 font-medium ml-1">
              ({Math.round(item.pct)}%)
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
