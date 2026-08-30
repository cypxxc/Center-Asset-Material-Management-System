import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { ITEM_STATUS_LABELS } from "@/features/items/types"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border text-[10px] font-bold select-none transition-colors",
  {
    variants: {
      variant: {
        success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10",
        info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10",
        warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10",
        destructive: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10",
        danger: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10",
        muted: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10",
      },
      size: {
        sm: "px-2 py-0.5 text-[9px]",
        default: "px-2.5 py-0.5 text-[10px]",
        lg: "px-3 py-1 text-xs",
      }
    },
    defaultVariants: {
      variant: "muted",
      size: "default",
    }
  }
)

const statusVariantsMap: Record<string, "success" | "info" | "warning" | "destructive" | "danger" | "muted"> = {
  active: "success",
  spare: "info",
  damaged: "danger",
  waiting_repair: "warning",
  disposed: "destructive",
  inactive: "muted",
}

const statusLabels: Record<string, string> = {
  ...ITEM_STATUS_LABELS,
  active: "ใช้งานอยู่",
  spare: "สำรอง",
  damaged: "ชำรุด",
  waiting_repair: "รอการซ่อมแซม",
  inactive: "ไม่ใช้งาน",
  disposed: "จำหน่ายแล้ว",
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  status?: string
  showDot?: boolean
  icon?: React.ReactNode
}

export function StatusBadge({
  className,
  status,
  variant,
  size,
  showDot = true,
  icon,
  children,
  ...props
}: StatusBadgeProps) {
  const cleanStatus = status?.toLowerCase() || ""
  const computedVariant = variant || (cleanStatus ? statusVariantsMap[cleanStatus] : undefined) || "muted"
  const label = children || (cleanStatus ? statusLabels[cleanStatus] || status : "")

  return (
    <span
      className={cn(badgeVariants({ variant: computedVariant, size }), className)}
      {...props}
    >
      {icon && <span className="mr-1 inline-flex items-center">{icon}</span>}
      {showDot && !icon && (
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {label}
    </span>
  )
}
