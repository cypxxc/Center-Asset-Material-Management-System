import { getItemsExplorerPageData } from '@/features/items/queries'
import { ItemListSearchParams } from '@/features/items/types'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite, canDelete } from '@/lib/permissions'
import { ItemsExplorerClient } from './items-explorer-client'
import { redirect } from 'next/navigation'

import { buildItemsUrl, resolveItemPageParams } from '@/features/items/list-params'

export async function ItemsPageContent({ searchParams, basePath = '/items' }: { searchParams: Promise<ItemListSearchParams & { deleted?: string }>; basePath?: '/items' | '/central-items' }) {
  const rawParams = await searchParams
  const params = resolveItemPageParams(basePath, rawParams)
  if (params.deleted === 'true') redirect(basePath)

  const [profile, pageData] = await Promise.all([
    getCurrentProfile(),
    getItemsExplorerPageData(params),
  ])
  if (!profile) {
    redirect('/login')
  }

  const { items, total, page, pageSize, totalPages, references, classificationCounts } = pageData

  // Normalize invalid or out-of-range page parameter
  if (params.page !== undefined) {
    const rawPage = Number(params.page)
    const validPage = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1
    const clampedPage = total > 0 ? Math.min(validPage, totalPages) : 1
    if (params.page !== String(clampedPage) && (clampedPage > 1 || params.page !== '1')) {
      const canonicalUrl = buildItemsUrl(basePath, {
        ...params,
        page: clampedPage > 1 ? String(clampedPage) : undefined,
      })
      redirect(canonicalUrl)
    }
  }

  return (
    <ItemsExplorerClient
      basePath={basePath}
      items={items}
      total={total}
      classificationCounts={classificationCounts}
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
      responsibleUsers={references.responsibleUsers}
    />
  )
}
