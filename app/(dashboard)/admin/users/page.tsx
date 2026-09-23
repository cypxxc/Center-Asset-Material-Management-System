import { requireAdmin } from '@/features/admin/actions'
import { getUsersPageData } from '@/features/admin/queries'
import { UsersPageSearchParams } from '@/features/admin/types'
import { redirect } from 'next/navigation'
import UsersClient from './users-client'

interface UsersPageProps {
  searchParams: Promise<UsersPageSearchParams>
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const auth = await requireAdmin()
  if (auth.error || !auth.profile) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const { profiles, totalCount, searchParams: initialSearchParams } = await getUsersPageData(params)

  return (
    <UsersClient
      currentUserId={auth.profile.id}
      initialProfiles={profiles}
      initialTotalCount={totalCount}
      initialSearchParams={initialSearchParams}
    />
  )
}
