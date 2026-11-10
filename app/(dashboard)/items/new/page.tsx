import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { getItemReferences } from '@/features/items/queries'
import { NewItemPageClient } from './new-item-page-client'

export const metadata = {
  title: 'ขึ้นทะเบียนครุภัณฑ์และพัสดุใหม่',
}

export default async function NewItemPage() {
  const profile = await getCurrentProfile()
  if (!canWrite(profile?.role)) {
    redirect('/items')
  }

  const references = await getItemReferences()

  return (
    <NewItemPageClient
      categories={references.categories}
      locations={references.locations}
      units={references.units}
    />
  )
}
