'use client'

import React, { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full rounded-xl border border-border bg-card p-6 shadow-sm text-center space-y-4">
        <h3 className="text-lg font-bold text-foreground">เกิดข้อผิดพลาดในการโหลดข้อมูล</h3>
        <p className="text-sm text-muted-foreground">
          ระบบไม่สามารถดึงข้อมูลได้ในขณะนี้ กรุณาตรวจสอบการเชื่อมต่อฐานข้อมูล Supabase ในไฟล์ .env.local หรือการตั้งค่า RLS ของคุณอีกครั้ง
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => reset()} className="font-semibold">
            ลองใหม่อีกครั้ง
          </Button>
        </div>
      </div>
    </div>
  )
}
