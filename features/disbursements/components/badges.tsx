import * as React from 'react'
import {
  FileEdit,
  CheckCircle2,
  Clock,
  RotateCcw,
  PackageCheck,
  Undo2,
  Ban,
  PackageMinus,
  ArrowRightLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DISBURSEMENT_TYPE_LABELS,
  DISBURSEMENT_STATUS_LABELS,
} from '@/features/disbursements/print-generator'
import type { DisbursementStatus, DisbursementTransactionType } from '@/features/disbursements/types'

const statusIcons: Record<DisbursementStatus, React.ComponentType<{ className?: string }>> = {
  draft: FileEdit,
  confirmed: CheckCircle2,
  active_borrow: Clock,
  partially_returned: RotateCcw,
  returned: PackageCheck,
  reversed: Undo2,
  cancelled: Ban,
}

const typeIcons: Record<DisbursementTransactionType, React.ComponentType<{ className?: string }>> = {
  material_issue: PackageMinus,
  asset_handover: ArrowRightLeft,
  asset_borrow: Clock,
}

export function DisbursementStatusBadge({
  status,
  className,
}: {
  status: DisbursementStatus
  className?: string
}) {
  const styles: Record<DisbursementStatus, string> = {
    draft: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    active_borrow: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    partially_returned: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    returned: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800',
    reversed: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
    cancelled: 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800',
  }

  const IconComponent = statusIcons[status] || FileEdit

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border select-none transition-colors shrink-0',
        styles[status] || styles.draft,
        className
      )}
    >
      <IconComponent className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{DISBURSEMENT_STATUS_LABELS[status] || status}</span>
    </span>
  )
}

export function DisbursementTypeBadge({
  type,
  className,
}: {
  type: DisbursementTransactionType
  className?: string
}) {
  const styles: Record<DisbursementTransactionType, string> = {
    material_issue: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
    asset_handover: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
    asset_borrow: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  }

  const IconComponent = typeIcons[type] || PackageMinus

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border select-none transition-colors shrink-0',
        styles[type] || 'bg-slate-50 text-slate-700 border-slate-200',
        className
      )}
    >
      <IconComponent className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{DISBURSEMENT_TYPE_LABELS[type] || type}</span>
    </span>
  )
}
