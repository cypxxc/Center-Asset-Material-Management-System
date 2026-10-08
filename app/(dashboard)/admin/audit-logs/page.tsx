import { requireAdmin } from '@/features/admin/actions'
import { getAuditLogsPageData } from '@/features/admin/queries'
import { AuditLogsPageSearchParams } from '@/features/admin/types'
import { redirect } from 'next/navigation'
import AuditLogsClient from './audit-logs-client'

interface AuditLogsPageProps {
  searchParams: Promise<AuditLogsPageSearchParams>
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const params = await searchParams
  const [auth, { logs, totalCount, searchParams: initialSearchParams }] = await Promise.all([
    requireAdmin(),
    getAuditLogsPageData(params),
  ])
  if (auth.error || !auth.profile) {
    redirect('/dashboard')
  }

  return (
    <AuditLogsClient
      currentUserId={auth.profile.id}
      initialLogs={logs}
      initialTotalCount={totalCount}
      initialSearchParams={initialSearchParams}
    />
  )
}
