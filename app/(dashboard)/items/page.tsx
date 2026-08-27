import { getItems, getItemReferences } from '@/features/items/queries'
import { ItemListSearchParams } from '@/features/items/types'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite, canDelete } from '@/lib/permissions'
import { ItemsExplorerClient } from './items-explorer-client'
import { redirect } from 'next/navigation'
import { getAssetNumberTemplates } from '@/features/asset-numbers/queries'

interface ItemsPageProps {
  searchParams: Promise<ItemListSearchParams & { deleted?: string }>
}

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const params = await searchParams

  const [profile, references, result, assetNumberTemplates] = await Promise.all([
    getCurrentProfile(),
    getItemReferences(),
    getItems(params),
    getAssetNumberTemplates(true)
  ])

  if (!profile) {
    redirect('/login')
  }

  const userCanWrite = canWrite(profile?.role)
  const userCanDelete = canDelete(profile?.role)
  if (params.deleted === 'true') redirect('/items')

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
      units={references.units}
      assetNumberTemplates={assetNumberTemplates}
    />
  )
}
