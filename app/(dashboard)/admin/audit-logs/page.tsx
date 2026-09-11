import { requireAdmin } from '@/features/admin/actions'
import { getAuditLogsList } from '@/features/admin/queries'
import { redirect } from 'next/navigation'
import AuditLogsClient from './audit-logs-client'

interface AuditLogsPageProps {
  searchParams: Promise<{
    q?: string
    action?: string
    target_table?: string
    page?: string
    pageSize?: string
  }>
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const auth = await requireAdmin()
  if (auth.error || !auth.profile) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const page = parseInt(params.page || '1', 10) || 1
  const pageSize = parseInt(params.pageSize || '50', 10) || 50

  const initialData = await getAuditLogsList({
    q: params.q,
    action: params.action,
    target_table: params.target_table,
    page,
    pageSize,
  })

  return (
    <AuditLogsClient
      currentUserId={auth.profile.id}
      initialLogs={initialData.logs}
      initialTotalCount={initialData.totalCount}
      initialSearchParams={{
        q: params.q || '',
        action: params.action || 'all',
        target_table: params.target_table || 'all',
        page,
        pageSize,
      }}
    />
  )
}
