import * as React from "react"
import { cn } from "@/lib/utils"

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: "7xl" | "full"
}

export function PageContainer({
  className,
  maxWidth = "7xl",
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "h-full overflow-y-auto bg-slate-50/50 p-6 md:p-8 font-sans text-slate-800",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "space-y-6",
          maxWidth === "7xl" ? "mx-auto max-w-7xl" : "w-full"
        )}
      >
        {children}
      </div>
    </div>
  )
}

export type PageSectionProps = React.HTMLAttributes<HTMLDivElement>

export const PageSection = React.forwardRef<HTMLDivElement, PageSectionProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("bg-white border border-slate-200 rounded-xl shadow-sm p-4 overflow-hidden flex flex-col min-h-0", className)}
      {...props}
    />
  )
)
PageSection.displayName = "PageSection"

export type PageToolbarProps = React.HTMLAttributes<HTMLDivElement>

export const PageToolbar = React.forwardRef<HTMLDivElement, PageToolbarProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50 p-3 rounded-lg border border-slate-200", className)}
      {...props}
    />
  )
)
PageToolbar.displayName = "PageToolbar"
