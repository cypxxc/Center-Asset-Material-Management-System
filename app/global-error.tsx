'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logging'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error(
      {
        operation: 'globalError',
        feature: 'root',
        details: { digest: error.digest },
      },
      error
    )
  }, [error])

  return (
    <html lang="th">
      <body className="font-sans antialiased min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center border border-slate-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">เกิดข้อผิดพลาดร้ายแรงของระบบ</h2>
          <p className="text-sm text-slate-500 mb-6">
            ขออภัย ระบบเกิดข้อผิดพลาดรุนแรงและไม่สามารถทำงานต่อได้ กรุณากดปุ่มด้านล่างเพื่อเริ่มการทำงานใหม่
          </p>
          <button
            onClick={() => reset()}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors cursor-pointer text-sm"
          >
            รีสตาร์ทระบบใหม่
          </button>
        </div>
      </body>
    </html>
  )
}
