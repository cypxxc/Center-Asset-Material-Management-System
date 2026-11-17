import { notFound, redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { getItemReferences } from '@/features/items/queries'
import { getMaterial } from '@/features/materials/queries'
import { MaterialForm } from '@/features/materials/material-form'
export const metadata = { title: 'แก้ไขวัสดุ' }
export default async function EditMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile()
  if (profile?.role !== 'admin') redirect('/materials')
  const { id } = await params
  const [material,references] = await Promise.all([getMaterial(id),getItemReferences()])
  if (!material) notFound()
  return <MaterialForm material={material} references={references} />
}
