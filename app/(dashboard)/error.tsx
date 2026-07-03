'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logging'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to server/client streams securely without leakages
    logger.error(
      {
        operation: 'errorBoundary',
        feature: 'layout',
        details: { digest: error.digest },
      },
      error
    )
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-white rounded-lg border border-slate-100 shadow-sm my-6">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-slate-800 mb-2">เกิดข้อผิดพลาดในการโหลดข้อมูล</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-md">
        ขออภัย ระบบไม่สามารถดึงข้อมูลรายการดังกล่าวได้ในขณะนี้ กรุณากดปุ่มด้านล่างเพื่อทำการโหลดใหม่อีกครั้ง
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
      >
        ลองใหม่อีกครั้ง
      </button>
    </div>
  )
}
