import { getItemsExplorerPageData } from '@/features/items/queries'
import { ItemListSearchParams } from '@/features/items/types'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite, canDelete } from '@/lib/permissions'
import { ItemsExplorerClient } from './items-explorer-client'
import { redirect } from 'next/navigation'

import { buildItemsUrl } from '@/features/items/list-params'

interface ItemsPageProps {
  searchParams: Promise<ItemListSearchParams & { deleted?: string }>
}

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const params = await searchParams
  if (params.deleted === 'true') redirect('/items')

  const [profile, pageData] = await Promise.all([
    getCurrentProfile(),
    getItemsExplorerPageData(params),
  ])
  if (!profile) {
    redirect('/login')
  }

  const { items, total, page, pageSize, totalPages, references } = pageData

  // Normalize invalid or out-of-range page parameter
  if (params.page !== undefined) {
    const rawPage = Number(params.page)
    const validPage = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1
    const clampedPage = total > 0 ? Math.min(validPage, totalPages) : 1
    if (params.page !== String(clampedPage) && (clampedPage > 1 || params.page !== '1')) {
      const canonicalUrl = buildItemsUrl('/items', {
        ...params,
        page: clampedPage > 1 ? String(clampedPage) : undefined,
      })
      redirect(canonicalUrl)
    }
  }

  return (
    <ItemsExplorerClient
      items={items}
      total={total}
      page={page}
      pageSize={pageSize}
      totalPages={totalPages}
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
