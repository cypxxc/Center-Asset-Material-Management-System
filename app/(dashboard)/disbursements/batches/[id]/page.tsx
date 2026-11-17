import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { getRequestBatch } from '@/features/disbursements/request-batch-queries'
import { batchSummary } from '@/features/disbursements/request-batch'
import { DisbursementStatusBadge, DisbursementTypeBadge } from '@/features/disbursements/components/badges'
import { PageContainer } from '@/components/ui/page-container'
import { formatDateTime } from '@/lib/date'

export const instant = false

export default async function RequestBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile()
  if (!profile?.is_active) redirect('/login')
  const { id } = await params
  const batch = await getRequestBatch(id)
  if (!batch) notFound()
  return <PageContainer maxWidth="7xl" contentClassName="max-w-5xl mx-auto">
    <div className="space-y-5">
      <Link href="/disbursements?tab=documents" className="text-sm text-primary underline">กลับหน้าเบิก / ยืม</Link>
      <h1 className="text-xl font-semibold">ชุดคำขอ</h1>
      <p className="break-all font-mono text-sm">{batch.id}</p>
      <p className="text-sm">ส่งเมื่อ {formatDateTime(batch.created_at)} · {batchSummary(batch.documents.map(doc => doc.status))}</p>
      <p className="text-sm text-muted-foreground">เอกสารในชุดสร้างพร้อมกัน การอนุมัติ ยกเลิก และรับคืนดำเนินการแยกตามเอกสาร</p>
      <ul className="space-y-3">{batch.documents.map(doc => <li key={doc.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <DisbursementTypeBadge type={doc.transaction_type} />
        <Link className="break-all text-primary underline" href={profile.role === 'admin' && ['pending_approval', 'draft'].includes(doc.status) ? `/disbursements?tab=requests&request_id=${doc.id}` : `/disbursements/${doc.id}`}>{doc.document_no || doc.id}</Link>
        <DisbursementStatusBadge status={doc.status} />
      </li>)}</ul>
    </div>
  </PageContainer>
}
