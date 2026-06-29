import { getItems, getItemReferences, getDeletedItems } from '@/features/items/queries'
import { ItemListSearchParams } from '@/features/items/types'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite, canDelete, canManageTrash } from '@/lib/permissions'
import { ItemsExplorerClient } from './items-explorer-client'
import { TrashExplorerClient } from './trash-explorer-client'
import { redirect } from 'next/navigation'

interface ItemsPageProps {
  searchParams: Promise<ItemListSearchParams & { deleted?: string }>
}

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const [params, profile, references] = await Promise.all([
    searchParams,
    getCurrentProfile(),
    getItemReferences()
  ])

  const userCanWrite = canWrite(profile?.role)
  const userCanDelete = canDelete(profile?.role)
  const userCanManageTrash = canManageTrash(profile?.role)

  // Trash view
  if (params.deleted === 'true') {
    if (!userCanManageTrash) redirect('/items')

    const result = await getDeletedItems(params)
    return (
      <TrashExplorerClient
        items={result.items}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        params={{ q: params.q, type: params.type, page: params.page }}
      />
    )
  }

  // Normal view
  const result = await getItems(params)

  return (
    <ItemsExplorerClient
      items={result.items}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      params={params}
      userCanWrite={userCanWrite}
      userCanDelete={userCanDelete}
      locations={references.locations}
      categories={references.categories}
    />
  )
}
