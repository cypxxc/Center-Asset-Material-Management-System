'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { createClient } from '@/lib/supabase/server'
import { categorySchema, locationSchema, unitSchema } from './schema'
import { clearReferencesCache } from '@/features/items/queries'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { checkRateLimit } from '@/lib/rate-limit'
import { startTimer } from '@/lib/performance'
import { writeAuditLog } from '@/lib/audit'
import { handleActionError } from '@/lib/error-handler'
import { logger } from '@/lib/logging'

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

async function requireSettingsManager() {
  const profile = await getCurrentProfile()

  if (!profile || !profile.is_active) {
    redirect('/settings?error=กรุณาเข้าสู่ระบบก่อนจัดการตั้งค่า')
  }

  if (profile.role !== 'admin' && profile.role !== 'staff') {
    redirect('/settings?error=คุณไม่มีสิทธิ์จัดการข้อมูลตั้งค่าระบบ')
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
  revalidatePath('/', 'layout')
  revalidateTag(CACHE_TAGS.ITEM_REFERENCES, 'max')
  clearReferencesCache()
}

export async function createCategory(formData: FormData) {
  const timer = startTimer()
  await requireSettingsManager()

  const rateLimitCheck = await checkRateLimit('createCategory', 30, 60000)
  if (!rateLimitCheck.success) {
    redirectToSettings('error', rateLimitCheck.error!, 'categories')
  }

  const parsed = categorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'กรุณาระบุชื่อหมวดหมู่', 'categories')

  const supabase = await createClient()
  try {
    const { error, data } = await supabase
      .from('categories')
      .insert(parsed.data)
      .select('id')
      .single()

    if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'categories')

    const profile = await getCurrentProfile()
    await writeAuditLog({
      operation: 'create',
      feature: 'settings',
      userId: profile?.id || null,
      targetType: 'categories',
      targetId: data?.id,
      newValues: parsed.data,
    })

    const durationMs = timer.stop()
    logger.info({
      operation: 'createCategory',
      feature: 'settings',
      userId: profile?.id || undefined,
      latency: durationMs,
      status: 'success',
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))) {
      throw err
    }
    const profile = await getCurrentProfile()
    await handleActionError(err, 'createCategory', 'settings', profile?.id)
    redirectToSettings('error', 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล', 'categories')
  }

  revalidateSettings()
  redirectToSettings('message', 'สร้างหมวดหมู่สำเร็จ', 'categories')
}

export async function updateCategory(id: string, formData: FormData) {
  const timer = startTimer()
  await requireSettingsManager()

  const rateLimitCheck = await checkRateLimit('updateCategory', 30, 60000)
  if (!rateLimitCheck.success) {
    redirectToSettings('error', rateLimitCheck.error!, 'categories')
  }

  const parsed = categorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'กรุณาระบุชื่อหมวดหมู่', 'categories')

  const usageError = await ensureCanDeactivate('category', id, parsed.data.is_active)
  if (usageError) redirectToSettings('error', usageError, 'categories')

  const supabase = await createClient()
  try {
    const { data: oldData } = await supabase
      .from('categories')
      .select('name, description, is_active')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('categories')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'categories')

    const profile = await getCurrentProfile()
    await writeAuditLog({
      operation: 'update',
      feature: 'settings',
      userId: profile?.id || null,
      targetType: 'categories',
      targetId: id,
      oldValues: oldData,
      newValues: parsed.data,
    })

    const durationMs = timer.stop()
    logger.info({
      operation: 'updateCategory',
      feature: 'settings',
      userId: profile?.id || undefined,
      latency: durationMs,
      status: 'success',
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))) {
      throw err
    }
    const profile = await getCurrentProfile()
    await handleActionError(err, 'updateCategory', 'settings', profile?.id)
    redirectToSettings('error', 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล', 'categories')
  }

  revalidateSettings()
  redirectToSettings('message', 'อัปเดตหมวดหมู่สำเร็จ', 'categories')
}

export async function createLocation(formData: FormData) {
  const timer = startTimer()
  await requireSettingsManager()

  const rateLimitCheck = await checkRateLimit('createLocation', 30, 60000)
  if (!rateLimitCheck.success) {
    redirectToSettings('error', rateLimitCheck.error!, 'locations')
  }

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
  try {
    const { error, data } = await supabase
      .from('locations')
      .insert(parsed.data)
      .select('id')
      .single()

    if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'locations')

    const profile = await getCurrentProfile()
    await writeAuditLog({
      operation: 'create',
      feature: 'settings',
      userId: profile?.id || null,
      targetType: 'locations',
      targetId: data?.id,
      newValues: parsed.data,
    })

    const durationMs = timer.stop()
    logger.info({
      operation: 'createLocation',
      feature: 'settings',
      userId: profile?.id || undefined,
      latency: durationMs,
      status: 'success',
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))) {
      throw err
    }
    const profile = await getCurrentProfile()
    await handleActionError(err, 'createLocation', 'settings', profile?.id)
    redirectToSettings('error', 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล', 'locations')
  }

  revalidateSettings()
  redirectToSettings('message', 'สร้างสถานที่สำเร็จ', 'locations')
}

export async function updateLocation(id: string, formData: FormData) {
  const timer = startTimer()
  await requireSettingsManager()

  const rateLimitCheck = await checkRateLimit('updateLocation', 30, 60000)
  if (!rateLimitCheck.success) {
    redirectToSettings('error', rateLimitCheck.error!, 'locations')
  }

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
  try {
    const { data: oldData } = await supabase
      .from('locations')
      .select('name, building, floor, room, department, description, is_active')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('locations')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'locations')

    const profile = await getCurrentProfile()
    await writeAuditLog({
      operation: 'update',
      feature: 'settings',
      userId: profile?.id || null,
      targetType: 'locations',
      targetId: id,
      oldValues: oldData,
      newValues: parsed.data,
    })

    const durationMs = timer.stop()
    logger.info({
      operation: 'updateLocation',
      feature: 'settings',
      userId: profile?.id || undefined,
      latency: durationMs,
      status: 'success',
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))) {
      throw err
    }
    const profile = await getCurrentProfile()
    await handleActionError(err, 'updateLocation', 'settings', profile?.id)
    redirectToSettings('error', 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล', 'locations')
  }

  revalidateSettings()
  redirectToSettings('message', 'อัปเดตสถานที่สำเร็จ', 'locations')
}

export async function createUnit(formData: FormData) {
  const timer = startTimer()
  await requireSettingsManager()

  const rateLimitCheck = await checkRateLimit('createUnit', 30, 60000)
  if (!rateLimitCheck.success) {
    redirectToSettings('error', rateLimitCheck.error!, 'units')
  }

  const parsed = unitSchema.safeParse({
    name: formData.get('name'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'กรุณาระบุชื่อหน่วยนับ', 'units')

  const supabase = await createClient()
  try {
    const { error, data } = await supabase
      .from('units')
      .insert(parsed.data)
      .select('id')
      .single()

    if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'units')

    const profile = await getCurrentProfile()
    await writeAuditLog({
      operation: 'create',
      feature: 'settings',
      userId: profile?.id || null,
      targetType: 'units',
      targetId: data?.id,
      newValues: parsed.data,
    })

    const durationMs = timer.stop()
    logger.info({
      operation: 'createUnit',
      feature: 'settings',
      userId: profile?.id || undefined,
      latency: durationMs,
      status: 'success',
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))) {
      throw err
    }
    const profile = await getCurrentProfile()
    await handleActionError(err, 'createUnit', 'settings', profile?.id)
    redirectToSettings('error', 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล', 'units')
  }

  revalidateSettings()
  redirectToSettings('message', 'สร้างหน่วยนับสำเร็จ', 'units')
}

export async function updateUnit(id: string, formData: FormData) {
  const timer = startTimer()
  await requireSettingsManager()

  const rateLimitCheck = await checkRateLimit('updateUnit', 30, 60000)
  if (!rateLimitCheck.success) {
    redirectToSettings('error', rateLimitCheck.error!, 'units')
  }

  const parsed = unitSchema.safeParse({
    name: formData.get('name'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'กรุณาระบุชื่อหน่วยนับ', 'units')

  const usageError = await ensureCanDeactivate('unit', id, parsed.data.is_active)
  if (usageError) redirectToSettings('error', usageError, 'units')

  const supabase = await createClient()
  try {
    const { data: oldData } = await supabase
      .from('units')
      .select('name, is_active')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('units')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'units')

    const profile = await getCurrentProfile()
    await writeAuditLog({
      operation: 'update',
      feature: 'settings',
      userId: profile?.id || null,
      targetType: 'units',
      targetId: id,
      oldValues: oldData,
      newValues: parsed.data,
    })

    const durationMs = timer.stop()
    logger.info({
      operation: 'updateUnit',
      feature: 'settings',
      userId: profile?.id || undefined,
      latency: durationMs,
      status: 'success',
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))) {
      throw err
    }
    const profile = await getCurrentProfile()
    await handleActionError(err, 'updateUnit', 'settings', profile?.id)
    redirectToSettings('error', 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล', 'units')
  }

  revalidateSettings()
  redirectToSettings('message', 'อัปเดตหน่วยนับสำเร็จ', 'units')
}

export async function updateProfile(id: string, formData: FormData) {
  const timer = startTimer()
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
  try {
    const { data: oldData } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('profiles')
      .update({
        role,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) redirectToSettings('error', error.message, 'users')

    await writeAuditLog({
      operation: 'update',
      feature: 'settings',
      userId: currentProfile?.id || null,
      targetType: 'profiles',
      targetId: id,
      oldValues: oldData,
      newValues: { role, is_active },
    })

    const durationMs = timer.stop()
    logger.info({
      operation: 'updateProfile',
      feature: 'settings',
      userId: currentProfile?.id || undefined,
      latency: durationMs,
      status: 'success',
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))) {
      throw err
    }
    await handleActionError(err, 'updateProfile', 'settings', currentProfile?.id)
    redirectToSettings('error', 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล', 'users')
  }

  revalidateSettings()
  redirectToSettings('message', 'อัปเดตโปรไฟล์ผู้ใช้งานสำเร็จ', 'users')
}

async function ensureCanDelete(kind: MetadataKind, id: string) {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq(itemReferenceColumn[kind], id)

  if (error) return 'ไม่สามารถตรวจสอบการใช้งานพัสดุก่อนทำการลบได้'
  if ((count ?? 0) > 0) return 'ไม่สามารถลบข้อมูลนี้ได้เนื่องจากกำลังถูกใช้งานโดยพัสดุในระบบ (รวมถึงพัสดุที่อยู่ในถังขยะ)'

  return null
}

export async function deleteCategory(id: string) {
  const timer = startTimer()
  await requireSettingsManager()

  const rateLimitCheck = await checkRateLimit('deleteCategory', 30, 60000)
  if (!rateLimitCheck.success) {
    redirectToSettings('error', rateLimitCheck.error!, 'categories')
  }

  const usageError = await ensureCanDelete('category', id)
  if (usageError) redirectToSettings('error', usageError, 'categories')

  const supabase = await createClient()
  try {
    const { data: oldData } = await supabase
      .from('categories')
      .select('name, description, is_active')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'categories')

    const profile = await getCurrentProfile()
    await writeAuditLog({
      operation: 'delete',
      feature: 'settings',
      userId: profile?.id || null,
      targetType: 'categories',
      targetId: id,
      oldValues: oldData,
    })

    const durationMs = timer.stop()
    logger.info({
      operation: 'deleteCategory',
      feature: 'settings',
      userId: profile?.id || undefined,
      latency: durationMs,
      status: 'success',
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))) {
      throw err
    }
    const profile = await getCurrentProfile()
    await handleActionError(err, 'deleteCategory', 'settings', profile?.id)
    redirectToSettings('error', 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล', 'categories')
  }

  revalidateSettings()
  redirectToSettings('message', 'ลบหมวดหมู่สำเร็จ', 'categories')
}

export async function deleteLocation(id: string) {
  const timer = startTimer()
  await requireSettingsManager()

  const rateLimitCheck = await checkRateLimit('deleteLocation', 30, 60000)
  if (!rateLimitCheck.success) {
    redirectToSettings('error', rateLimitCheck.error!, 'locations')
  }

  const usageError = await ensureCanDelete('location', id)
  if (usageError) redirectToSettings('error', usageError, 'locations')

  const supabase = await createClient()
  try {
    const { data: oldData } = await supabase
      .from('locations')
      .select('name, building, floor, room, department, description, is_active')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id)

    if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'locations')

    const profile = await getCurrentProfile()
    await writeAuditLog({
      operation: 'delete',
      feature: 'settings',
      userId: profile?.id || null,
      targetType: 'locations',
      targetId: id,
      oldValues: oldData,
    })

    const durationMs = timer.stop()
    logger.info({
      operation: 'deleteLocation',
      feature: 'settings',
      userId: profile?.id || undefined,
      latency: durationMs,
      status: 'success',
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))) {
      throw err
    }
    const profile = await getCurrentProfile()
    await handleActionError(err, 'deleteLocation', 'settings', profile?.id)
    redirectToSettings('error', 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล', 'locations')
  }

  revalidateSettings()
  redirectToSettings('message', 'ลบสถานที่สำเร็จ', 'locations')
}

export async function deleteUnit(id: string) {
  const timer = startTimer()
  await requireSettingsManager()

  const rateLimitCheck = await checkRateLimit('deleteUnit', 30, 60000)
  if (!rateLimitCheck.success) {
    redirectToSettings('error', rateLimitCheck.error!, 'units')
  }

  const usageError = await ensureCanDelete('unit', id)
  if (usageError) redirectToSettings('error', usageError, 'units')

  const supabase = await createClient()
  try {
    const { data: oldData } = await supabase
      .from('units')
      .select('name, is_active')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('units')
      .delete()
      .eq('id', id)

    if (error) redirectToSettings('error', friendlyDatabaseError(error.message), 'units')

    const profile = await getCurrentProfile()
    await writeAuditLog({
      operation: 'delete',
      feature: 'settings',
      userId: profile?.id || null,
      targetType: 'units',
      targetId: id,
      oldValues: oldData,
    })

    const durationMs = timer.stop()
    logger.info({
      operation: 'deleteUnit',
      feature: 'settings',
      userId: profile?.id || undefined,
      latency: durationMs,
      status: 'success',
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))) {
      throw err
    }
    const profile = await getCurrentProfile()
    await handleActionError(err, 'deleteUnit', 'settings', profile?.id)
    redirectToSettings('error', 'ระบบเกิดข้อผิดพลาดในการประมวลผลข้อมูล', 'units')
  }

  revalidateSettings()
  redirectToSettings('message', 'ลบหน่วยนับสำเร็จ', 'units')
}

