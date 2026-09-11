import { requireAdmin } from '@/features/admin/actions'
import { getProfilesList } from '@/features/admin/queries'
import { redirect } from 'next/navigation'
import UsersClient from './users-client'

interface UsersPageProps {
  searchParams: Promise<{
    q?: string
    role?: string
    is_active?: string
    page?: string
    pageSize?: string
  }>
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const auth = await requireAdmin()
  if (auth.error || !auth.profile) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const page = parseInt(params.page || '1', 10) || 1
  const pageSize = parseInt(params.pageSize || '50', 10) || 50

  const initialData = await getProfilesList({
    q: params.q,
    role: params.role,
    is_active: params.is_active,
    page,
    pageSize,
  })

  return (
    <UsersClient
      currentUserId={auth.profile.id}
      initialProfiles={initialData.profiles}
      initialTotalCount={initialData.totalCount}
      initialSearchParams={{
        q: params.q || '',
        role: params.role || 'all',
        is_active: params.is_active || 'all',
        page,
        pageSize,
      }}
    />
  )
}
