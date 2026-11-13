import dynamic from 'next/dynamic'
import { getDisbursements } from '@/features/disbursements/queries'
import { logger } from '@/lib/logging'
import type { DisbursementRow } from '@/features/disbursements/types'

const AdminWorkQueueView = dynamic(
  () => import('./dashboard-admin-work-queue-view').then((m) => m.AdminWorkQueueView),
  { ssr: true }
)

export async function AdminDashboardWorkQueue() {
  let pendingRequests: DisbursementRow[] = []
  let failed = false
  try {
    const result = await getDisbursements({ status: 'pending_approval', pageSize: 100 })
    pendingRequests = result.items
  } catch (error) {
    logger.error({ operation: 'loadDashboardPendingApprovals', feature: 'dashboard' }, error)
    failed = true
  }
  if (failed) {
    return <section role="alert" className="rounded-xl border border-border bg-card p-4 text-sm text-card-foreground">
      <h2 className="font-semibold">รออนุมัติ</h2>
      <p className="mt-2 text-muted-foreground">ไม่สามารถโหลดคิวงานได้</p>
      <a href="/dashboard" className="mt-2 inline-flex min-h-8 items-center rounded text-xs text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">ลองใหม่อีกครั้ง</a>
    </section>
  }
  return <AdminWorkQueueView documents={pendingRequests} />
}

export function AdminWorkQueueSkeleton() {
  return <div role="status" aria-label="กำลังโหลดรายการรออนุมัติ" className="space-y-3 rounded-xl border border-border bg-card p-4 sm:px-5">
    <div className="h-5 w-40 rounded bg-muted motion-safe:animate-pulse" />
    <div className="h-4 w-64 max-w-full rounded bg-muted motion-safe:animate-pulse" />
    <div className="h-20 rounded bg-muted/50 motion-safe:animate-pulse" />
  </div>
}
