'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { createClient } from '@/lib/supabase/server'
import { categorySchema, locationSchema, unitSchema } from './schema'
import { clearReferencesCache } from '@/features/items/queries'

type MetadataKind = 'category' | 'location' | 'unit'

const itemReferenceColumn: Record<MetadataKind, 'category_id' | 'location_id' | 'unit_id'> = {
  category: 'category_id',
  location: 'location_id',
  unit: 'unit_id',
}

async function requireAdmin() {
  const profile = await getCurrentProfile()

  if (!profile || !profile.is_active) {
    redirect('/settings?error=กรุณาเข้าสู่ระบบก่อนจัดการตั้งค่า')
  }

  if (profile.role !== 'admin') {
    redirect('/settings?error=เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการตั้งค่าได้')
  }
}

function redirectToSettings(type: 'message' | 'error', text: string, tab?: string): never {
  const tabQuery = tab ? `&tab=${tab}` : ''
  redirect(`/settings?${type}=${encodeURIComponent(text)}${tabQuery}`)
}

function friendlyDatabaseError(message: string) {
  if (message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique')) {
    return 'มีข้อมูลชื่อนี้อยู่ในระบบแล้ว'
  }

  return 'ไม่สามารถบันทึกการตั้งค่าได้ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง'
}

async function ensureCanDeactivate(kind: MetadataKind, id: string, nextActive: boolean) {
  if (nextActive) return null

  const supabase = await createClient()
  const { count, error } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq(itemReferenceColumn[kind], id)
    .is('deleted_at', null)

  if (error) return 'ไม่สามารถตรวจสอบการใช้งานพัสดุก่อนเปลี่ยนสถานะได้'
  if ((count ?? 0) > 0) return 'ข้อมูลนี้กำลังถูกใช้งานโดยพัสดุในระบบ และไม่สามารถปิดการใช้งานได้'

  return null
}

function revalidateSettings() {
  revalidatePath('/settings')
  revalidatePath('/items/new')
  revalidatePath('/items')
  clearReferencesCache()
}

export async function createCategory(formData: FormData) {
  await requireAdmin()
  const parsed = categorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'กรุณาระบุชื่อหมวดหมู่', 'categories')

  const supabase = await createClient()
  const { error } = await supabase.from('categories').insert(parsed.data)
  if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'categories')

  revalidateSettings()
  redirectToSettings('message', 'สร้างหมวดหมู่สำเร็จ', 'categories')
}

export async function updateCategory(id: string, formData: FormData) {
  await requireAdmin()
  const parsed = categorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'กรุณาระบุชื่อหมวดหมู่', 'categories')

  const usageError = await ensureCanDeactivate('category', id, parsed.data.is_active)
  if (usageError) redirectToSettings('error', usageError, 'categories')

  const supabase = await createClient()
  const { error } = await supabase
    .from('categories')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'categories')

  revalidateSettings()
  redirectToSettings('message', 'อัปเดตหมวดหมู่สำเร็จ', 'categories')
}

export async function createLocation(formData: FormData) {
  await requireAdmin()
  const parsed = locationSchema.safeParse({
    name: formData.get('name'),
    building: formData.get('building'),
    floor: formData.get('floor'),
    room: formData.get('room'),
    department: formData.get('department'),
    description: formData.get('description'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'กรุณาระบุชื่อสถานที่', 'locations')

  const supabase = await createClient()
  const { error } = await supabase.from('locations').insert(parsed.data)
  if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'locations')

  revalidateSettings()
  redirectToSettings('message', 'สร้างสถานที่สำเร็จ', 'locations')
}

export async function updateLocation(id: string, formData: FormData) {
  await requireAdmin()
  const parsed = locationSchema.safeParse({
    name: formData.get('name'),
    building: formData.get('building'),
    floor: formData.get('floor'),
    room: formData.get('room'),
    department: formData.get('department'),
    description: formData.get('description'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'กรุณาระบุชื่อสถานที่', 'locations')

  const usageError = await ensureCanDeactivate('location', id, parsed.data.is_active)
  if (usageError) redirectToSettings('error', usageError, 'locations')

  const supabase = await createClient()
  const { error } = await supabase
    .from('locations')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'locations')

  revalidateSettings()
  redirectToSettings('message', 'อัปเดตสถานที่สำเร็จ', 'locations')
}

export async function createUnit(formData: FormData) {
  await requireAdmin()
  const parsed = unitSchema.safeParse({
    name: formData.get('name'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'กรุณาระบุชื่อหน่วยนับ', 'units')

  const supabase = await createClient()
  const { error } = await supabase.from('units').insert(parsed.data)
  if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'units')

  revalidateSettings()
  redirectToSettings('message', 'สร้างหน่วยนับสำเร็จ', 'units')
}

export async function updateUnit(id: string, formData: FormData) {
  await requireAdmin()
  const parsed = unitSchema.safeParse({
    name: formData.get('name'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'กรุณาระบุชื่อหน่วยนับ', 'units')

  const usageError = await ensureCanDeactivate('unit', id, parsed.data.is_active)
  if (usageError) redirectToSettings('error', usageError, 'units')

  const supabase = await createClient()
  const { error } = await supabase
    .from('units')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'units')

  revalidateSettings()
  redirectToSettings('message', 'อัปเดตหน่วยนับสำเร็จ', 'units')
}

export async function updateProfile(id: string, formData: FormData) {
  await requireAdmin()
  const currentProfile = await getCurrentProfile()
  if (currentProfile?.id === id) {
    redirectToSettings('error', 'ไม่สามารถแก้ไขโปรไฟล์ของตนเองได้', 'users')
  }

  const role = formData.get('role') as string
  const isActiveCheckbox = formData.get('is_active')

  if (role !== 'admin' && role !== 'staff' && role !== 'viewer') {
    redirectToSettings('error', 'สิทธิ์ที่เลือกไม่ถูกต้อง', 'users')
  }

  const is_active = isActiveCheckbox === 'on' || isActiveCheckbox === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      role,
      is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) redirectToSettings('error', error.message, 'users')

  revalidateSettings()
  redirectToSettings('message', 'อัปเดตโปรไฟล์ผู้ใช้งานสำเร็จ', 'users')
}
