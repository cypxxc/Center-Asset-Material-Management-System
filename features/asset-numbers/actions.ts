'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { createClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit'
import { isAdmin } from '@/lib/permissions'

function redirectToSettings(type: 'message' | 'error', text: string): never {
  redirect(`/settings?${type}=${encodeURIComponent(text)}&tab=asset-numbers`)
}

async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active || !isAdmin(profile.role)) {
    redirectToSettings('error', 'เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการแม่แบบเลขครุภัณฑ์ได้')
  }
  return profile
}

function getTemplateData(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const pattern = String(formData.get('pattern') ?? '').trim()
  if (!name || !pattern || name.length > 120 || pattern.length > 150) return null
  return { name, pattern, field_defaults: {}, is_active: formData.get('is_active') === 'on' }
}

export async function createAssetNumberTemplate(formData: FormData) {
  const profile = await requireAdmin()
  const parsed = getTemplateData(formData)
  if (!parsed) redirectToSettings('error', 'กรุณาระบุชื่อ รูปแบบ และค่าเริ่มต้น JSON ให้ถูกต้อง')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('asset_number_templates')
    .insert({ ...parsed, created_by: profile.id, updated_by: profile.id })
    .select('id')
    .single()
  if (error) redirectToSettings('error', error.code === '23505' ? 'มีชื่อแม่แบบนี้แล้ว' : 'ไม่สามารถบันทึกแม่แบบได้')
  await writeAuditLog({ operation: 'create', feature: 'asset-numbers', userId: profile.id, targetType: 'asset_number_templates', targetId: data.id, newValues: parsed })
  revalidatePath('/settings')
  revalidatePath('/items')
  redirectToSettings('message', 'สร้างแม่แบบเลขครุภัณฑ์แล้ว')
}

export async function updateAssetNumberTemplate(id: string, formData: FormData) {
  const profile = await requireAdmin()
  const parsed = getTemplateData(formData)
  if (!parsed) redirectToSettings('error', 'กรุณาระบุชื่อ รูปแบบ และค่าเริ่มต้น JSON ให้ถูกต้อง')
  const supabase = await createClient()
  const { data: oldData } = await supabase.from('asset_number_templates').select('name, pattern, field_defaults, is_active').eq('id', id).maybeSingle()
  const { error } = await supabase.from('asset_number_templates').update({ ...parsed, updated_by: profile.id, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) redirectToSettings('error', error.code === '23505' ? 'มีชื่อแม่แบบนี้แล้ว' : 'ไม่สามารถบันทึกแม่แบบได้')
  await writeAuditLog({ operation: 'update', feature: 'asset-numbers', userId: profile.id, targetType: 'asset_number_templates', targetId: id, oldValues: oldData ?? undefined, newValues: parsed })
  revalidatePath('/settings')
  revalidatePath('/items')
  redirectToSettings('message', 'บันทึกแม่แบบเลขครุภัณฑ์แล้ว')
}

export async function deleteAssetNumberTemplate(id: string) {
  const profile = await requireAdmin()
  const supabase = await createClient()
  const { data: oldData } = await supabase
    .from('asset_number_templates')
    .select('name, pattern')
    .eq('id', id)
    .maybeSingle()
  const { error } = await supabase.from('asset_number_templates').delete().eq('id', id)
  if (error) redirectToSettings('error', 'ไม่สามารถลบแม่แบบได้')
  await writeAuditLog({ operation: 'delete', feature: 'asset-numbers', userId: profile.id, targetType: 'asset_number_templates', targetId: id, oldValues: oldData ?? undefined })
  revalidatePath('/settings')
  revalidatePath('/items')
  redirectToSettings('message', 'ลบแม่แบบเลขครุภัณฑ์แล้ว')
}
