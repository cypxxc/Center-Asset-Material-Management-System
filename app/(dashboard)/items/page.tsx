import { getItems } from '@/features/items/queries'
import { ItemListSearchParams } from '@/features/items/types'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite, canDelete } from '@/lib/permissions'
import { ItemsExplorerClient } from './items-explorer-client'

interface ItemsPageProps {
  searchParams: Promise<ItemListSearchParams>
}

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const [params, profile] = await Promise.all([
    searchParams,
    getCurrentProfile()
  ])
  const result = await getItems(params)
  const userCanWrite = canWrite(profile?.role)
  const userCanDelete = canDelete(profile?.role)

  return (
    <ItemsExplorerClient
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      params={params}
      userCanWrite={userCanWrite}
      userCanDelete={userCanDelete}
    />
  )
}
