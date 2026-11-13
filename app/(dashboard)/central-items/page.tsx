import type { ItemListSearchParams } from '@/features/items/types'
import { ItemsPageContent } from '../items/items-page-content'

export const metadata = { title: 'ส่วนกลาง' }

export default function CentralItemsPage({ searchParams }: {
  searchParams: Promise<ItemListSearchParams & { deleted?: string }>
}) {
  return <ItemsPageContent searchParams={searchParams} basePath="/central-items" />
}
