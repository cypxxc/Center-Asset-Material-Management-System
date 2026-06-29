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
  const params = await searchParams

  const [profile, references, result] = await Promise.all([
    getCurrentProfile(),
    getItemReferences(),
    params.deleted === 'true' ? getDeletedItems(params) : getItems(params)
  ])

  const userCanWrite = canWrite(profile?.role)
  const userCanDelete = canDelete(profile?.role)
  const userCanManageTrash = canManageTrash(profile?.role)

  // Trash view
  if (params.deleted === 'true') {
    if (!userCanManageTrash) redirect('/items')

    const trashResult = result as Awaited<ReturnType<typeof getDeletedItems>>
    return (
      <TrashExplorerClient
        items={trashResult.items}
        total={trashResult.total}
        page={trashResult.page}
        totalPages={trashResult.totalPages}
        params={{ q: params.q, type: params.type, page: params.page }}
      />
    )
  }

  // Normal view
  const normalResult = result as Awaited<ReturnType<typeof getItems>>


  return (
    <ItemsExplorerClient
      items={normalResult.items}
      total={normalResult.total}
      page={normalResult.page}
      totalPages={normalResult.totalPages}
      params={params}
      userCanWrite={userCanWrite}
      userCanDelete={userCanDelete}
      locations={references.locations}
      categories={references.categories}
    />
  )
}
