import * as React from "react"
import { cn } from "@/lib/utils"

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full border border-slate-100 rounded-xl bg-white shadow-sm overflow-hidden animate-pulse">
      <div className="bg-slate-50 border-b border-slate-100 h-9" />
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center h-10 px-4 gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className={cn("bg-slate-100 h-3 rounded-md", c === 0 ? "w-1/4" : "flex-1")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
