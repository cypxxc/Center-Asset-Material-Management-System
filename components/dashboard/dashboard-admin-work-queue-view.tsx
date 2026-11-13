import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, ClipboardList } from 'lucide-react'
import type { DisbursementRow } from '@/features/disbursements/types'
import type { AdminWorkQueueSummary } from '@/features/disbursements/admin-work-queue-types'
import { GroupedTransactionsTable } from '@/features/disbursements/components/grouped-transactions-table'

export function AdminWorkQueueView({ documents, summary }: { documents?: DisbursementRow[]; summary?: AdminWorkQueueSummary }) {
  const approvalDocuments = documents ?? summary?.items.filter(item => item.kind === 'pending').map(item => ({
    ...item,
    request_number: item.document_no ?? undefined,
    fiscal_year: null,
    status: 'pending_approval' as const,
    confirmed_at: null,
    confirmed_by: null,
    reversal_reason: null,
    reversed_at: null,
    reversed_by: null,
    created_by: null,
    updated_at: item.created_at,
    requested_items: [],
  })) ?? []
  return <section aria-labelledby="admin-work-queue-title" className="w-full min-w-0 space-y-3 text-card-foreground">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="admin-work-queue-title" className="flex items-center gap-2 text-sm font-semibold"><ClipboardList className="size-4 text-muted-foreground" aria-hidden="true" />รออนุมัติ</h2>
      <Link href="/disbursements?tab=requests&status=pending_approval" className="inline-flex min-h-8 items-center gap-1 rounded text-xs text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">ดูคำขอทั้งหมด<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
    </div>
    {approvalDocuments.length > 0
      ? <GroupedTransactionsTable documents={approvalDocuments} userRole="admin" />
      : <div className="flex min-h-28 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm text-muted-foreground"><CheckCircle2 className="size-4" aria-hidden="true" />ไม่มีรายการรออนุมัติ</div>}
  </section>
}
