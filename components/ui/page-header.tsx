import * as React from "react"
import { cn } from "@/lib/utils"

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode
  subtitle?: string
  actions?: React.ReactNode
}

export function PageHeader({
  className,
  title,
  subtitle,
  actions,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5 print:hidden",
        className
      )}
      {...props}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 leading-tight">
          {title}
        </h1>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  )
}
