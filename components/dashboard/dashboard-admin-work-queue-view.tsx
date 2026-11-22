'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowUpRight, CheckCircle2, ClipboardList } from 'lucide-react'
import type { DisbursementRow } from '@/features/disbursements/types'
import type { AdminWorkQueueSummary } from '@/features/disbursements/admin-work-queue-types'

const GroupedTransactionsTable = dynamic(
  () => import('@/features/disbursements/components/grouped-transactions-table').then(m => m.GroupedTransactionsTable),
  {
    ssr: false,
    loading: () => <div className="h-28 rounded-lg bg-muted/30 motion-safe:animate-pulse" />
  }
)

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

  if (approvalDocuments.length === 0) {
    return (
      <section aria-labelledby="admin-work-queue-title" className="w-full min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <h2 id="admin-work-queue-title" className="font-semibold text-foreground">รออนุมัติ</h2>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1.5 text-emerald-700 [:is(.dark,[data-theme=dark])_&]:text-emerald-400 font-medium">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              ไม่มีรายการรออนุมัติ
            </span>
          </div>
          <Link href="/disbursements?tab=requests&status=pending_approval" className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0">
            ดูคำขอทั้งหมด<ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="admin-work-queue-title" className="w-full min-w-0 space-y-3 text-card-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="admin-work-queue-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ClipboardList className="size-4 text-muted-foreground" aria-hidden="true" />
            รออนุมัติ
          </h2>
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
            {approvalDocuments.length} รายการ
          </span>
        </div>
        <Link href="/disbursements?tab=requests&status=pending_approval" className="inline-flex min-h-8 items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring">
          ดูคำขอทั้งหมด<ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <GroupedTransactionsTable
        documents={approvalDocuments}
        userRole="admin"
        maxRows={5}
        wrapperClassName="border border-border rounded-xl shadow-2xs"
      />
    </section>
  )
}
