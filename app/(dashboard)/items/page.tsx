import type { ItemListSearchParams } from '@/features/items/types'
import { ItemsPageContent } from './items-page-content'

interface ItemsPageProps {
  searchParams: Promise<ItemListSearchParams & { deleted?: string }>
}

export async function generateMetadata({ searchParams }: ItemsPageProps) {
  const params = await searchParams
  return {
    title: params.is_central === 'true' || params.is_central === '1'
      ? 'ส่วนกลาง'
      : params.type === 'material'
      ? 'ทะเบียนพัสดุ'
      : params.type === 'asset'
        ? 'ทะเบียนครุภัณฑ์'
        : 'ทะเบียนรายการ',
  }
}

export default function ItemsPage({ searchParams }: ItemsPageProps) {
  return <ItemsPageContent searchParams={searchParams} />
}
