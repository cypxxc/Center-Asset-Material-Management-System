import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { getItemReferences } from '@/features/items/queries'
import { MaterialForm } from '@/features/materials/material-form'
export const metadata = { title: 'เพิ่มวัสดุ' }
export default async function NewMaterialPage() {
  const profile = await getCurrentProfile()
  if (profile?.role !== 'admin') redirect('/materials')
  return <MaterialForm references={await getItemReferences()} />
}
