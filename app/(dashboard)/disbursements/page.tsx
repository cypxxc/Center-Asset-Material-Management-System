import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { canCreateDisbursement } from '@/lib/permissions'
import { getDisbursements, getCentralAvailableItems } from '@/features/disbursements/queries'
import { DisbursementListClient } from '@/features/disbursements/components/disbursement-list-client'
import DisbursementsLoading from './loading'

export const instant = false
export const metadata = { title: 'ทะเบียนเบิก-จ่ายและยืมพัสดุส่วนกลาง' }

interface DisbursementsPageProps {
  searchParams: Promise<{
    q?: string
    request_id?: string
    status?: string
    type?: string
    page?: string
    pageSize?: string
    tab?: 'catalog' | 'documents' | 'requests' | 'history'
  }>
}

async function DisbursementListSection({
  searchParamsPromise,
  profile,
}: {
  searchParamsPromise: Promise<{
    q?: string
    request_id?: string
    status?: string
    type?: string
    page?: string
    pageSize?: string
    tab?: 'catalog' | 'documents' | 'requests' | 'history'
  }>
  profile: {
    id: string
    full_name?: string | null
    role: string
    department?: string | null
  }
}) {
  const rawParams = await searchParamsPromise
  const params = rawParams.tab === 'history' && profile.role !== 'admin' ? { ...rawParams, tab: 'documents' as const } : rawParams
  const effectiveStatus = profile.role === 'admin' && (params.tab === 'requests' || params.tab === 'history')
    ? params.status || 'all'
    : params.status
  const [result, centralItems] = await Promise.all([
    getDisbursements({
      q: params.q,
      request_id: profile.role === 'admin' && params.tab === 'requests' ? params.request_id : undefined,
      status: effectiveStatus === 'all' ? undefined : effectiveStatus,
      prioritizePending: profile.role === 'admin' && params.tab === 'requests',
      hideCompleted: profile.role === 'admin' && params.tab === 'requests',
      historyOnly: profile.role === 'admin' && params.tab === 'history',
      type: params.type,
      page: params.page,
      pageSize: params.pageSize,
    }),
    getCentralAvailableItems(),
  ])

  return (
    <DisbursementListClient
      initialItems={result.items}
      total={result.total}
      currentPage={result.page}
      pageSize={result.pageSize}
      totalPages={result.totalPages}
      currentQ={params.q || ''}
      currentStatus={effectiveStatus || ''}
      currentType={params.type || ''}
      canCreate={canCreateDisbursement(profile.role)}
      stats={result.stats}
      centralItems={centralItems}
      userRole={profile.role}
      initialTab={params.tab}
    />
  )
}

export default async function DisbursementsPage({ searchParams }: DisbursementsPageProps) {
  const profile = await getCurrentProfile()
  if (!profile?.is_active) {
    redirect('/login')
  }

  return (
    <Suspense fallback={<DisbursementsLoading />}>
      <DisbursementListSection searchParamsPromise={searchParams} profile={profile} />
    </Suspense>
  )
}


