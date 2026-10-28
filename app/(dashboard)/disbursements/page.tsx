import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite } from '@/lib/permissions'
import { getDisbursements } from '@/features/disbursements/queries'
import { DisbursementListClient } from '@/features/disbursements/components/disbursement-list-client'
import DisbursementsLoading from './loading'

export const instant = false

interface DisbursementsPageProps {
  searchParams: Promise<{
    q?: string
    status?: string
    type?: string
    page?: string
    pageSize?: string
  }>
}

async function DisbursementListSection({
  searchParamsPromise,
  role,
}: {
  searchParamsPromise: Promise<{
    q?: string
    status?: string
    type?: string
    page?: string
    pageSize?: string
  }>
  role: string
}) {
  const params = await searchParamsPromise
  const result = await getDisbursements({
    q: params.q,
    status: params.status,
    type: params.type,
    page: params.page,
    pageSize: params.pageSize,
  })

  return (
    <DisbursementListClient
      initialItems={result.items}
      total={result.total}
      currentPage={result.page}
      pageSize={result.pageSize}
      totalPages={result.totalPages}
      currentQ={params.q || ''}
      currentStatus={params.status || ''}
      currentType={params.type || ''}
      canCreate={canWrite(role)}
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
      <DisbursementListSection searchParamsPromise={searchParams} role={profile.role} />
    </Suspense>
  )
}

