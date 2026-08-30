import * as React from "react"
import { cn } from "@/lib/utils"
import { Folder } from "lucide-react"

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({
  className,
  title,
  description,
  icon = <Folder className="h-10 w-10 text-slate-300 opacity-60" />,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-dashed border-slate-200 min-h-[250px] shadow-sm select-none",
        className
      )}
      {...props}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-4 border border-slate-100">
        {icon}
      </div>
      <h4 className="text-sm font-bold text-slate-700 leading-tight">{title}</h4>
      {description && (
        <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
