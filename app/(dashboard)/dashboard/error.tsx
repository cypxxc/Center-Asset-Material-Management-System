'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { logger } from '@/lib/logging'
import { PageContainer } from '@/components/ui/page-container'

export default function DashboardError({ error, retry }: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    logger.error({ operation: 'loadAcquisitionChart', feature: 'dashboard', details: { digest: error.digest } }, error)
  }, [error])

  return <PageContainer maxWidth="full">
    <div role="alert" className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 text-center text-card-foreground">
      <AlertCircle className="size-7 text-destructive" aria-hidden="true" />
      <h2 className="text-lg font-semibold">ไม่สามารถโหลดข้อมูล dashboard ได้</h2>
      <p className="text-sm text-muted-foreground">กรุณาลองโหลดข้อมูลอีกครั้ง</p>
      <button type="button" onClick={retry} className="mt-2 min-h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">ลองใหม่อีกครั้ง</button>
    </div>
  </PageContainer>
}
