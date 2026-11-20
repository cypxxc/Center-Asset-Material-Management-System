'use client'

import { cn } from '@/lib/utils'

export interface DashboardChartTooltipItem {
  label: string
  value: string | number
  unit?: string
  colorClass?: string
}

export interface DashboardChartTooltipProps {
  title: string
  value?: string | number
  unit?: string
  badge?: {
    text: string
    type?: 'up' | 'down' | 'flat' | 'neutral'
  } | null
  items?: DashboardChartTooltipItem[]
  note?: string
  x: number
  y?: number
  containerWidth: number
  containerHeight?: number
}

export function DashboardChartTooltip({
  title,
  value,
  unit,
  badge,
  items,
  note,
  x,
  y,
  containerWidth,
  containerHeight = 174,
}: DashboardChartTooltipProps) {
  const TOOLTIP_WIDTH = 184
  const PADDING = 8

  // Clamp horizontal position so tooltip never clips left or right edge
  const minLeft = PADDING
  const maxLeft = Math.max(minLeft, containerWidth - TOOLTIP_WIDTH - PADDING)
  const left = Math.max(minLeft, Math.min(x - TOOLTIP_WIDTH / 2, maxLeft))

  // Determine vertical position:
  // If target Y is lower in the chart (> 80), position above the point;
  // If target Y is higher in the chart (<= 80), position below the point.
  let top = 8
  if (y !== undefined) {
    if (y > 80) {
      top = Math.max(PADDING, y - 76)
    } else {
      top = Math.min(containerHeight - 74, y + 14)
    }
  }

  return (
    <div
      role="tooltip"
      aria-hidden="true"
      className="pointer-events-none absolute z-30 flex flex-col gap-1 rounded-[8px] border border-border/80 bg-popover px-2.5 py-2 text-popover-foreground shadow-md transition-all duration-100 ease-out select-none"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${TOOLTIP_WIDTH}px`,
      }}
    >
      {/* Header: Period / Year & Badge */}
      <div className="flex items-center justify-between gap-1.5 border-b border-border/50 pb-1 text-[11px] font-medium text-muted-foreground">
        <span className="truncate">{title}</span>
        {badge && (
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-semibold tabular-nums tracking-tight shrink-0",
              badge.type === 'up' && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
              badge.type === 'down' && "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20",
              (badge.type === 'flat' || badge.type === 'neutral') && "bg-muted text-muted-foreground border border-border/60"
            )}
          >
            {badge.text}
          </span>
        )}
      </div>

      {/* Prominent Primary Value */}
      {value !== undefined && (
        <div className="flex items-baseline gap-1 text-sm font-bold font-mono tracking-tight text-foreground">
          <span>{value}</span>
          {unit && <span className="text-xs font-normal text-muted-foreground font-sans">{unit}</span>}
        </div>
      )}

      {/* Breakdown / Secondary items */}
      {items && items.length > 0 && (
        <div className="space-y-0.5 pt-0.5">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-1 text-[11px]">
              <span className="flex items-center gap-1.5 text-muted-foreground truncate">
                {item.colorClass && (
                  <span className={cn("size-1.5 rounded-full shrink-0", item.colorClass)} aria-hidden="true" />
                )}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="font-mono font-medium tabular-nums text-foreground shrink-0">
                {item.value} {item.unit && <span className="text-muted-foreground font-sans text-[10px]">{item.unit}</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Optional Note */}
      {note && (
        <div className="text-[10px] text-muted-foreground/80 truncate">
          {note}
        </div>
      )}
    </div>
  )
}
