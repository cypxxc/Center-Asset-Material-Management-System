import { LoadingSpinner } from "./loading-spinner"
import { Preloader3D } from "./preloader-3d"
import { cn } from "@/lib/utils"

export function LoadingOverlay({
  className,
  variant = 'spinner',
  label = 'กำลังโหลดข้อมูล...',
}: {
  className?: string
  variant?: 'spinner' | '3d'
  label?: string
}) {
  return (
    <div className={cn("absolute inset-0 bg-white/60 backdrop-blur-[1px] z-30 flex items-center justify-center animate-in fade-in duration-200", className)}>
      {variant === '3d' ? (
        <Preloader3D size={100} label={label} />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <LoadingSpinner className="size-6 text-slate-600" />
          <span className="text-[10px] font-bold text-slate-500">{label}</span>
        </div>
      )}
    </div>
  )
}
