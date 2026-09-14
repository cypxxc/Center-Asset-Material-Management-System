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
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden",
        className
      )}
      {...props}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-snug">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  )
}
