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
