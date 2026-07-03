import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <Loader2 className={cn("animate-spin text-slate-500 size-5", className)} />
  )
}
