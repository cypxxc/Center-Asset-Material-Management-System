import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { CheckCircle2, PackageCheck, Wrench, AlertTriangle, Ban, MinusCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { ITEM_STATUS_LABELS } from "@/features/items/types"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border text-[11px] font-medium select-none transition-colors max-w-full",
  {
    variants: {
      variant: {
        success: "border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400",
        info: "border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-400",
        warning: "border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400",
        destructive: "border-red-200/80 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400",
        danger: "border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400",
        muted: "border-slate-200/80 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-400",
      },
      size: {
        sm: "px-2 py-0.5 text-[10.5px] leading-tight gap-1",
        default: "px-2.5 py-0.5 text-[11px] leading-tight gap-1.5",
        lg: "px-3 py-1 text-xs leading-normal gap-1.5",
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

const statusIconsMap: Record<string, React.ComponentType<{ className?: string }>> = {
  active: CheckCircle2,
  spare: PackageCheck,
  waiting_repair: Wrench,
  damaged: AlertTriangle,
  disposed: Ban,
  inactive: MinusCircle,
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
  size = "default",
  showDot = true,
  icon,
  children,
  ...props
}: StatusBadgeProps) {
  const cleanStatus = status?.toLowerCase() || ""
  const computedVariant = variant || (cleanStatus ? statusVariantsMap[cleanStatus] : undefined) || "muted"
  const label = children || (cleanStatus ? statusLabels[cleanStatus] || status : "")
  const StatusIcon = cleanStatus ? statusIconsMap[cleanStatus] : null

  const iconSizeClass = size === "sm" ? "w-3 h-3" : size === "lg" ? "w-3.5 h-3.5" : "w-3 h-3"

  return (
    <span
      className={cn(badgeVariants({ variant: computedVariant, size }), className)}
      {...props}
    >
      {icon ? (
        <span className="inline-flex items-center shrink-0">{icon}</span>
      ) : showDot ? (
        StatusIcon ? (
          <StatusIcon className={cn(iconSizeClass, "shrink-0")} aria-hidden="true" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
        )
      ) : null}
      <span className="truncate">{label}</span>
    </span>
  )
}
