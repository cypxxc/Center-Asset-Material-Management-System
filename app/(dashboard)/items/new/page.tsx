import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite } from '@/lib/permissions'
import { redirect } from 'next/navigation'

export default async function NewItemPage() {
  const profile = await getCurrentProfile()
  if (!canWrite(profile?.role)) {
    redirect('/items')
  }

  redirect('/items?new=true')
}
