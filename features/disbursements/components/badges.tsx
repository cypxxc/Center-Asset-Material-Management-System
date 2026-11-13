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
 Hourglass,
 XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
 DISBURSEMENT_TYPE_LABELS,
 DISBURSEMENT_STATUS_LABELS,
} from '@/features/disbursements/print-generator'
import type { DisbursementStatus, DisbursementTransactionType } from '@/features/disbursements/types'

const statusIcons: Record<DisbursementStatus, React.ComponentType<{ className?: string }>> = {
 draft: FileEdit,
 pending_approval: Hourglass,
 confirmed: CheckCircle2,
 active_borrow: Clock,
 partially_returned: RotateCcw,
 returned: PackageCheck,
 reversed: Undo2,
 cancelled: Ban,
 rejected: XCircle,
}

const typeIcons: Record<DisbursementTransactionType, React.ComponentType<{ className?: string }>> = {
 material_issue: PackageMinus,
 asset_handover: ArrowRightLeft,
 asset_borrow: Clock,
}

export function DisbursementStatusBadge({
 status,
 className,
 label,
}: {
 status: DisbursementStatus
 className?: string
 label?: string
}) {
 const styles: Record<DisbursementStatus, string> = {
 draft: 'bg-slate-100 text-slate-700 border-slate-300 ',
 pending_approval: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
 confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200 ',
 active_borrow: 'bg-amber-50 text-amber-700 border-amber-200 ',
 partially_returned: 'bg-blue-50 text-blue-700 border-blue-200 ',
 returned: 'bg-teal-50 text-teal-700 border-teal-200 ',
 reversed: 'bg-rose-50 text-rose-700 border-rose-200 ',
 cancelled: 'bg-zinc-100 text-zinc-500 border-zinc-200 ',
 rejected: 'bg-rose-100 text-rose-800 border-rose-300 ',
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
 <span className="truncate">{label ?? (DISBURSEMENT_STATUS_LABELS[status] || status)}</span>
 </span>
 )
}

export function DisbursementTypeBadge({
 type,
 className,
 label,
}: {
 type: DisbursementTransactionType
 className?: string
 label?: string
}) {
 const styles: Record<DisbursementTransactionType, string> = {
 material_issue: 'bg-sky-50 text-sky-700 border-sky-200 ',
 asset_handover: 'bg-indigo-50 text-indigo-700 border-indigo-200 ',
 asset_borrow: 'bg-orange-50 text-orange-700 border-orange-200 ',
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
 <span className="truncate">{label ?? (DISBURSEMENT_TYPE_LABELS[type] || type)}</span>
 </span>
 )
}
