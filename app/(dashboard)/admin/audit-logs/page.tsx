import { requireAdmin } from '@/features/admin/actions'
import { getAuditLogsPageData } from '@/features/admin/queries'
import { AuditLogsPageSearchParams } from '@/features/admin/types'
import { redirect } from 'next/navigation'
import AuditLogsClient from './audit-logs-client'

export const metadata = { title: 'Logs' }

interface AuditLogsPageProps {
  searchParams: Promise<AuditLogsPageSearchParams & { tab?: string; status?: string; type?: string }>
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const params = await searchParams
  const auth = await requireAdmin()
  if (auth.error || !auth.profile) {
    redirect('/dashboard')
  }

  if (params.tab === 'history') {
    const destination = new URLSearchParams({ action: 'approval_history' })
    for (const key of ['q', 'page', 'pageSize'] as const) {
      if (params[key]) destination.set(key, params[key])
    }
    redirect(`/admin/audit-logs?${destination}`)
  }
  const { logs, totalCount, searchParams: initialSearchParams } = await getAuditLogsPageData(params)
  return <AuditLogsClient
    currentUserId={auth.profile.id}
    initialLogs={logs}
    initialTotalCount={totalCount}
    initialSearchParams={initialSearchParams}
  />
}
