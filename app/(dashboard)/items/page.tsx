import type { ItemListSearchParams } from '@/features/items/types'
import { ItemsPageContent } from './items-page-content'
import { redirect } from 'next/navigation'

interface ItemsPageProps {
  searchParams: Promise<ItemListSearchParams & { deleted?: string }>
}

export const metadata = { title: 'ทะเบียนครุภัณฑ์' }

export default function ItemsPage({ searchParams }: ItemsPageProps) {
  const assetParams = searchParams.then(params => {
    if (params.type === 'material') redirect('/materials')
    return { ...params, type: 'asset' }
  })
  return <ItemsPageContent searchParams={assetParams} />
}
