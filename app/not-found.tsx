import Link from 'next/link'
import { FileQuestion, Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-primary border border-primary/20">
          <FileQuestion className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            404
          </h1>
          <h2 className="text-xl font-semibold text-foreground">
            ไม่พบหน้าที่คุณต้องการ
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            หน้าที่คุณกำลังค้นหาอาจถูกย้าย ลบ หรือคุณไม่มีสิทธิ์เข้าถึงเส้นทางนี้ กรุณาตรวจสอบ URL อีกครั้ง
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Home className="w-4 h-4" />
            <span>กลับสู่หน้าหลัก</span>
          </Link>
          <Link
            href="/items"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ทะเบียนพัสดุ</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
