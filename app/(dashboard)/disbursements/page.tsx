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
    status?: string
    type?: string
    page?: string
    pageSize?: string
    tab?: 'catalog' | 'documents'
  }>
}

async function DisbursementListSection({
  searchParamsPromise,
  profile,
}: {
  searchParamsPromise: Promise<{
    q?: string
    status?: string
    type?: string
    page?: string
    pageSize?: string
    tab?: 'catalog' | 'documents'
  }>
  profile: {
    id: string
    full_name?: string | null
    role: string
    department?: string | null
  }
}) {
  const params = await searchParamsPromise
  const [result, centralItems] = await Promise.all([
    getDisbursements({
      q: params.q,
      status: params.status,
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
      currentStatus={params.status || ''}
      currentType={params.type || ''}
      canCreate={canCreateDisbursement(profile.role)}
      stats={result.stats}
      centralItems={centralItems}
      userRole={profile.role}
      currentUser={profile}
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


