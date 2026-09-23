import { getItemsExplorerPageData } from '@/features/items/queries'
import { ItemListSearchParams } from '@/features/items/types'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite, canDelete } from '@/lib/permissions'
import { ItemsExplorerClient } from './items-explorer-client'
import { redirect } from 'next/navigation'

interface ItemsPageProps {
  searchParams: Promise<ItemListSearchParams & { deleted?: string }>
}

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const params = await searchParams
  if (params.deleted === 'true') redirect('/items')

  const profile = await getCurrentProfile()
  if (!profile) {
    redirect('/login')
  }

  const { items, total, nextCursor, references } = await getItemsExplorerPageData(params)

  return (
    <ItemsExplorerClient
      items={items}
      total={total}
      nextCursor={nextCursor}
      userId={profile.id}
      params={params}
      userCanWrite={canWrite(profile?.role)}
      userCanDelete={canDelete(profile?.role)}
      locations={references.locations}
      categories={references.categories}
      units={references.units}
    />
  )
}
