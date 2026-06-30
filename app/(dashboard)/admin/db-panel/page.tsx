import { requireAdmin } from '@/features/admin/actions'
import { redirect } from 'next/navigation'
import DBPanelClient from './db-panel-client'

export default async function DBPanelPage() {
  const auth = await requireAdmin()
  if (auth.error) {
    redirect('/dashboard')
  }

  return <DBPanelClient />
}
