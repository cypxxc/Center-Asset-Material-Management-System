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
  icon = <Folder className="h-10 w-10 text-muted-foreground/50" />,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-12 bg-card rounded-2xl border border-dashed border-border min-h-[250px] shadow-xs select-none",
        className
      )}
      {...props}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-4 border border-border/60">
        {icon}
      </div>
      <h4 className="text-sm font-bold text-foreground leading-tight">{title}</h4>
      {description && (
        <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
