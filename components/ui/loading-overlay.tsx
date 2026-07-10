import * as React from "react"
import { LoadingSpinner } from "./loading-spinner"
import { cn } from "@/lib/utils"

export function LoadingOverlay({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 bg-white/60 backdrop-blur-[1px] z-30 flex items-center justify-center animate-in fade-in duration-200", className)}>
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner className="size-6 text-slate-600" />
        <span className="text-[10px] font-bold text-slate-500">กำลังโหลดข้อมูล...</span>
      </div>
    </div>
  )
}
