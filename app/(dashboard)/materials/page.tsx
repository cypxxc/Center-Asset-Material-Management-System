import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { getItemsExplorerPageData } from '@/features/items/queries'
import type { ItemListSearchParams } from '@/features/items/types'
import { getMaterialLedgerForIds } from '@/features/materials/queries'
import { canWrite, canDelete } from '@/lib/permissions'
import { ItemsExplorerClient } from '../items/items-explorer-client'

export const metadata = { title: 'ทะเบียนวัสดุ' }
type MaterialsPageProps = { searchParams: Promise<ItemListSearchParams> }

export default function MaterialsPage({ searchParams }: MaterialsPageProps) {
  return <Suspense fallback={<div className="p-4 sm:p-6" role="status" aria-busy="true">กำลังโหลดข้อมูลวัสดุ…</div>}>
    <MaterialsContent searchParams={searchParams} />
  </Suspense>
}

async function MaterialsContent({ searchParams }: MaterialsPageProps) {
  const params = { ...await searchParams, type: 'material', qualification: undefined }
  const [profile, data] = await Promise.all([getCurrentProfile(), getItemsExplorerPageData(params)])
  if (!profile) redirect('/login')
  const ledger = new Map((await getMaterialLedgerForIds(data.items.map(item => item.id))).map(item => [item.id, item]))
  const items = data.items.map(item => ({ ...item, material: ledger.get(item.id) }))
  return <ItemsExplorerClient
    basePath="/materials"
    items={items}
    total={data.total}
    classificationCounts={data.classificationCounts}
    page={data.page}
    pageSize={data.pageSize}
    totalPages={data.totalPages}
    userId={profile.id}
    params={params}
    userCanWrite={canWrite(profile.role)}
    userCanDelete={canDelete(profile.role)}
    {...data.references}
  />
}