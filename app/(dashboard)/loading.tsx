import { Preloader3D } from '@/components/ui/preloader-3d'

export default function Loading() {
  return (
    <div className="h-full w-full min-h-[400px] flex items-center justify-center bg-background text-foreground">
      <Preloader3D size={120} label="กำลังโหลดข้อมูล..." />
    </div>
  )
}

