import * as React from "react"
import { cn } from "@/lib/utils"

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("border border-slate-100 rounded-xl p-4 space-y-3 bg-white animate-pulse", className)}>
      <div className="bg-slate-100 h-4 w-1/3 rounded-md" />
      <div className="bg-slate-100 h-8 w-full rounded-md" />
      <div className="bg-slate-100 h-3 w-1/2 rounded-md" />
    </div>
  )
}
