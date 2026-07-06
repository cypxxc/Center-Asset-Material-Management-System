'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { createClient } from '@/lib/supabase/server'
import { itemFormSchema } from './schema'
import { getReportItemsList } from '@/features/reports/queries'
import { ItemListSearchParams } from './types'
import { clearReferencesCache } from './queries'
import { stripBom, normalizeForStorage, normalizeForSearch, normalizeFilename, preventCSVInjection } from '@/lib/unicode'
import { logger } from '@/lib/logging'
import { ActionResponse, successResponse, errorResponse } from '@/lib/actions-helper'
import { checkRateLimit } from '@/lib/rate-limit'
import { startTimer } from '@/lib/performance'
import { writeAuditLog } from '@/lib/audit'
import { handleActionError } from '@/lib/error-handler'
import { metrics } from '@/lib/metrics'
import { retryStorage } from '@/lib/retry'
import { getRequestContext, withTraceContext } from '@/lib/tracing'
import { CACHE_TAGS } from '@/lib/cache-tags'

// Bust sidebar data cache (layout scope) whenever items change
function revalidateSidebarCache() {
  revalidateTag(CACHE_TAGS.SIDEBAR_DATA, 'max')
  revalidatePath('/', 'layout')
}



export type ItemActionState = ActionResponse

async function requireEditor() {
  const profile = await getCurrentProfile()

  if (!profile || !profile.is_active) {
    return { error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ', profile: null }
  }

  if (profile.role !== 'admin' && profile.role !== 'staff') {
    return { error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลสิ่งของ', profile: null }
  }

  return { error: null, profile }
}

async function requireDeletePermission() {
  const profile = await getCurrentProfile()

  if (!profile || !profile.is_active) {
    return { error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ', profile: null }
  }

  if (profile.role !== 'admin') {
    return { error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ทำรายการนี้', profile: null }
  }

  return { error: null, profile }
}

function parseFormData(formData: FormData) {
  return itemFormSchema.safeParse({
    item_name: formData.get('item_name'),
    item_type: formData.get('item_type'),
    category_id: formData.get('category_id'),
    quantity: formData.get('quantity'),
    unit_id: formData.get('unit_id'),
    asset_no: formData.get('asset_no'),
    serial_no: formData.get('serial_no'),
    brand: formData.get('brand'),
    model: formData.get('model'),
    location_id: formData.get('location_id'),
    responsible_person: formData.get('responsible_person'),
    status: formData.get('status'),
    note: formData.get('note'),
    image_url: formData.get('image_url'),
  })
}

function friendlyDatabaseError(message: string) {
  if (message.includes('unique_asset_no_not_deleted')) {
    return 'เลขครุภัณฑ์นี้มีอยู่ในระบบแล้ว'
  }

  if (message.includes('unique_serial_no_not_deleted')) {
    return 'Serial Number นี้มีอยู่ในระบบแล้ว'
  }

  return 'ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบข้อมูลอีกครั้ง'
}

async function deleteOldImage(url: string | null) {
  if (!url) return
  try {
    const bucketMarker = '/storage/v1/object/public/item-images/'
    const markerIndex = url.indexOf(bucketMarker)
    if (markerIndex !== -1) {
      const filename = url.substring(markerIndex + bucketMarker.length)
      const supabase = await createClient()
      await retryStorage(async () => {
        const { error } = await supabase.storage.from('item-images').remove([filename])
        if (error) throw error
      })
    }
  } catch (error) {
    logger.error({ operation: 'deleteImage', feature: 'items', details: 'Failed to delete old image from storage' }, error)
  }
}

async function handleImageUpload(
  formData: FormData,
  currentImageUrl: string | null = null
): Promise<{ imageUrl: string | null; oldImageUrlToDelete?: string | null; error?: string }> {
  const removeImage = formData.get('remove_image') === 'true'
  const file = formData.get('image_file') as File | null
  const hasFile = file && file.size > 0

  if (removeImage) {
    return { imageUrl: null, oldImageUrlToDelete: currentImageUrl }
  }

  if (hasFile) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return { imageUrl: null, error: 'กรุณาอัปโหลดไฟล์รูปภาพประเภท JPEG, PNG หรือ WEBP เท่านั้น' }
    }
    if (file.size > 5 * 1024 * 1024) {
      return { imageUrl: null, error: 'ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB' }
    }

    try {
      const fileBuffer = await file.arrayBuffer()
      const safeFilename = normalizeFilename(file.name)
      const fileExt = safeFilename.split('.').pop() || 'jpg'
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const supabase = await createClient()

      await retryStorage(async () => {
        const result = await supabase.storage.from('item-images').upload(fileName, Buffer.from(fileBuffer), {
          contentType: file.type,
        })
        if (result.error) throw result.error
        return result
      })

      const { data: { publicUrl } } = supabase.storage
        .from('item-images')
        .getPublicUrl(fileName)

      return { imageUrl: publicUrl, oldImageUrlToDelete: currentImageUrl }
    } catch {
      return { imageUrl: null, error: 'เกิดข้อผิดพลาดในการประมวลผลไฟล์รูปภาพ' }
    }
  }

  return { imageUrl: currentImageUrl }
}

export async function createItem(
  _prevState: ItemActionState | null,
  formData: FormData
): Promise<ItemActionState> {
  const timer = startTimer()
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return { message: auth.error ?? 'Unauthorized' }

  // Rate limiting check
  const rateLimitCheck = await checkRateLimit('createItem', 30, 60000)
  if (!rateLimitCheck.success) {
    return { message: rateLimitCheck.error! }
  }

  formData.set('image_url', '')
  const initialParsed = parseFormData(formData)
  if (!initialParsed.success) {
    return {
      message: 'กรุณาตรวจสอบข้อมูลในฟอร์ม',
      fieldErrors: initialParsed.error.flatten().fieldErrors,
    }
  }

  const uploadResult = await handleImageUpload(formData)
  if (uploadResult.error) {
    return { message: uploadResult.error }
  }
  formData.set('image_url', uploadResult.imageUrl || '')

  const parsed = parseFormData(formData)
  if (!parsed.success) {
    if (uploadResult.imageUrl) {
      await deleteOldImage(uploadResult.imageUrl)
    }
    return {
      message: 'กรุณาตรวจสอบข้อมูลในฟอร์ม',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()
  let newItem: { id: string } | null = null
  try {
    const { data, error } = await supabase
      .from('items')
      .insert({
        ...parsed.data,
        created_by: auth.profile.id,
        updated_by: auth.profile.id,
      })
      .select('id')
      .single()

    if (error || !data) {
      if (uploadResult.imageUrl) {
        await deleteOldImage(uploadResult.imageUrl)
      }
      return { message: friendlyDatabaseError(error?.message || 'Database error') }
    }
    newItem = data

    // Centralized Audit Log - non-blocking
    setImmediate(async () => {
      if (newItem) {
        await writeAuditLog({
          operation: 'create',
          feature: 'items',
          userId: auth.profile.id,
          targetType: 'items',
          targetId: newItem.id,
          newValues: parsed.data,
        })
      }
    })

    const durationMs = timer.stop()
    const ctx = await getRequestContext(auth.profile.id)
    metrics.itemCreated()
    logger.info(withTraceContext(ctx, {
      operation: 'createItem',
      feature: 'items',
      action: 'createItem',
      userId: auth.profile.id,
      latency: durationMs,
      status: 'success',
    }))
  } catch (err) {
    if (uploadResult.imageUrl) {
      await deleteOldImage(uploadResult.imageUrl)
    }
    const errRes = await handleActionError(err, 'createItem', 'items', auth.profile.id)
    return { message: errRes.message! }
  }

  revalidatePath('/items')
  revalidateSidebarCache()
  redirect('/items')
}

export async function updateItem(
  id: string,
  _prevState: ItemActionState | null,
  formData: FormData
): Promise<ItemActionState> {
  const timer = startTimer()
  const supabase = await createClient()

  let auth
  let oldItem = null

  try {
    // Run authentication check and database old item fetch in parallel to minimize network latency
    const [authResult, oldItemResult] = await Promise.all([
      requireEditor(),
      supabase
        .from('items')
        .select('*')
        .eq('id', id)
        .single()
    ])

    auth = authResult
    if (auth.error || !auth.profile) return { message: auth.error ?? 'Unauthorized' }

    if (oldItemResult.error || !oldItemResult.data) {
      return { message: 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย หรือไม่พบพัสดุดังกล่าว' }
    }
    oldItem = oldItemResult.data
  } catch {
    return { message: 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย หรือไม่พบพัสดุดังกล่าว' }
  }

  // Rate Limiter
  const rateLimitCheck = await checkRateLimit('updateItem', 30, 60000)
  if (!rateLimitCheck.success) {
    return { message: rateLimitCheck.error! }
  }

  const currentImageUrl = oldItem?.image_url || null

  formData.set('image_url', currentImageUrl || '')
  const initialParsed = parseFormData(formData)
  if (!initialParsed.success) {
    return {
      message: 'กรุณาตรวจสอบข้อมูลในฟอร์ม',
      fieldErrors: initialParsed.error.flatten().fieldErrors,
    }
  }

  const uploadResult = await handleImageUpload(formData, currentImageUrl)
  if (uploadResult.error) {
    return { message: uploadResult.error }
  }
  formData.set('image_url', uploadResult.imageUrl || '')

  const parsed = parseFormData(formData)
  if (!parsed.success) {
    if (uploadResult.imageUrl && uploadResult.imageUrl !== currentImageUrl) {
      await deleteOldImage(uploadResult.imageUrl)
    }
    return {
      message: 'กรุณาตรวจสอบข้อมูลในฟอร์ม',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const { error } = await supabase
      .from('items')
      .update({
        ...parsed.data,
        updated_by: auth.profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) {
      if (uploadResult.imageUrl && uploadResult.imageUrl !== currentImageUrl) {
        await deleteOldImage(uploadResult.imageUrl)
      }
      return { message: friendlyDatabaseError(error.message) }
    }

    // Centralized Audit Log - non-blocking
    if (oldItem) {
      setImmediate(async () => {
        const cleanOld: Record<string, unknown> = { ...oldItem }
        const removeKey = (obj: Record<string, unknown>, key: string) => { delete obj[key] }
        removeKey(cleanOld, 'created_at')
        removeKey(cleanOld, 'updated_at')
        removeKey(cleanOld, 'created_by')
        removeKey(cleanOld, 'updated_by')
        removeKey(cleanOld, 'deleted_at')
        removeKey(cleanOld, 'deleted_by')
        
        await writeAuditLog({
          operation: 'update',
          feature: 'items',
          userId: auth.profile.id,
          targetType: 'items',
          targetId: id,
          oldValues: cleanOld,
          newValues: parsed.data,
        })
      })
    }

    const durationMs = timer.stop()
    logger.info({
      operation: 'updateItem',
      feature: 'items',
      userId: auth.profile.id,
      latency: durationMs,
      status: 'success',
    })
  } catch (err) {
    if (uploadResult.imageUrl && uploadResult.imageUrl !== currentImageUrl) {
      await deleteOldImage(uploadResult.imageUrl)
    }
    const errRes = await handleActionError(err, 'updateItem', 'items', auth.profile.id)
    return { message: errRes.message! }
  }

  if (uploadResult.oldImageUrlToDelete && uploadResult.oldImageUrlToDelete !== uploadResult.imageUrl) {
    // Non-blocking image deletion
    setImmediate(() => deleteOldImage(uploadResult.oldImageUrlToDelete!))
  }

  revalidatePath('/items')
  revalidateSidebarCache()
  revalidatePath(`/items/${id}`)
  redirect(`/items/${id}`)
}

export async function softDeleteItem(id: string) {
  const timer = startTimer()
  const profile = await getCurrentProfile()

  if (!profile || profile.role !== 'admin') {
    return { message: 'เฉพาะผู้ดูแลระบบเท่านั้นที่ลบรายการได้' }
  }

  // Rate Limiter
  const rateLimitCheck = await checkRateLimit('softDeleteItem', 30, 60000)
  if (!rateLimitCheck.success) {
    return { message: rateLimitCheck.error! }
  }

  const supabase = await createClient()
  try {
    const { error, data } = await supabase
      .from('items')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: profile.id,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')

    if (error) {
      logger.error({ operation: 'softDeleteItem', feature: 'items', userId: profile.id, details: { id } }, error)
      return { message: 'ไม่สามารถลบรายการได้: ' + error.message }
    }

    // RLS block จะ return error=null แต่ data=[]
    if (!data || data.length === 0) {
      logger.warn({ operation: 'softDeleteItem', feature: 'items', userId: profile.id, details: { note: '0 rows updated - possible RLS block or item not found', id } })
      return { message: 'ไม่สามารถลบรายการได้ (สิทธิ์ไม่เพียงพอหรือไม่พบรายการ)' }
    }

    const timestamp = new Date().toISOString()
    // Centralized Audit Log - non-blocking, query item details asynchronously
    setImmediate(async () => {
      try {
        const { data: oldItem } = await supabase
          .from('items')
          .select('item_name, asset_no, serial_no')
          .eq('id', id)
          .single()
        
        await writeAuditLog({
          operation: 'delete',
          feature: 'items',
          userId: profile.id,
          targetType: 'items',
          targetId: id,
          oldValues: oldItem || null,
          newValues: { deleted_at: timestamp },
        })
      } catch (err) {
        logger.error({ operation: 'softDeleteItemAudit', feature: 'items', userId: profile.id, details: { id } }, err)
      }
    })

    const durationMs = timer.stop()
    const ctx = await getRequestContext(profile.id)
    metrics.itemDeleted()
    logger.info(withTraceContext(ctx, {
      operation: 'softDeleteItem',
      feature: 'items',
      action: 'softDeleteItem',
      userId: profile.id,
      latency: durationMs,
      status: 'success',
    }))
  } catch (err) {
    const errRes = await handleActionError(err, 'softDeleteItem', 'items', profile.id)
    return { message: errRes.message! }
  }

  revalidatePath('/items')
  revalidateSidebarCache()
  redirect('/items')
}

export async function bulkUpdateItems(ids: string[], updates: { location_id?: string; status?: string }): Promise<ActionResponse> {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) {
    logger.warn({ operation: 'bulkUpdateItems', feature: 'items', details: 'Unauthorized bulk update attempt' })
    return errorResponse(auth.error ?? 'Unauthorized')
  }

  if (!ids.length) {
    return errorResponse('กรุณาเลือกรายการที่ต้องการแก้ไข')
  }

  const supabase = await createClient()
  const payload: Record<string, unknown> = {
    updated_by: auth.profile.id,
    updated_at: new Date().toISOString(),
  }
  if (updates.location_id !== undefined) payload.location_id = updates.location_id || null
  if (updates.status !== undefined) payload.status = updates.status

  const { error } = await supabase
    .from('items')
    .update(payload)
    .in('id', ids)
    .is('deleted_at', null)

  if (error) {
    logger.error({ operation: 'bulkUpdateItems', feature: 'items', userId: auth.profile.id, details: { ids } }, error)
    return errorResponse('ไม่สามารถอัปเดตรายการได้: ' + error.message)
  }

  // Log in audit logs
  const auditLogs = ids.map(id => ({
    user_id: auth.profile!.id,
    action: 'update',
    target_table: 'items',
    target_id: id,
    new_data: updates
  }))
  await supabase.from('audit_logs').insert(auditLogs)

  logger.info({ operation: 'bulkUpdateItems', feature: 'items', userId: auth.profile.id, details: { count: ids.length } })

  revalidatePath('/items')
  revalidateSidebarCache()
  return successResponse(`อัปเดตเรียบร้อย ${ids.length} รายการ`)
}

export async function bulkDeleteItems(ids: string[]): Promise<ActionResponse> {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') {
    logger.warn({ operation: 'bulkDeleteItems', feature: 'items', details: 'Unauthorized bulk delete attempt' })
    return errorResponse('เฉพาะผู้ดูแลระบบเท่านั้นที่ลบรายการได้')
  }

  if (!ids.length) {
    return errorResponse('กรุณาเลือกรายการที่ต้องการลบ')
  }

  const supabase = await createClient()
  const { error, data } = await supabase
    .from('items')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: profile.id,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .is('deleted_at', null)
    .select('id')

  if (error) {
    logger.error({ operation: 'bulkDeleteItems', feature: 'items', userId: profile.id, details: { ids } }, error)
    return errorResponse('ไม่สามารถลบรายการได้: ' + error.message)
  }

  if (!data || data.length === 0) {
    logger.warn({ operation: 'bulkDeleteItems', feature: 'items', userId: profile.id, details: '0 rows updated - RLS block or already deleted' })
    return errorResponse('ไม่สามารถลบรายการได้ (สิทธิ์ไม่เพียงพอหรือไม่พบรายการ)')
  }

  // Log in audit logs
  const auditLogs = ids.map(id => ({
    user_id: profile!.id,
    action: 'delete',
    target_table: 'items',
    target_id: id,
    new_data: { deleted_at: new Date().toISOString() }
  }))
  await supabase.from('audit_logs').insert(auditLogs)

  logger.info({ operation: 'bulkDeleteItems', feature: 'items', userId: profile.id, details: { count: ids.length } })

  revalidatePath('/items')
  revalidateSidebarCache()
  return successResponse(`ลบเรียบร้อย ${ids.length} รายการ`)
}

// ============================================================
// Trash: Restore & Hard Delete
// ============================================================

export async function restoreItem(id: string): Promise<ActionResponse> {
  const auth = await requireDeletePermission()
  if (auth.error || !auth.profile) {
    logger.warn({ operation: 'restoreItem', feature: 'items', details: 'Unauthorized restore attempt' })
    return errorResponse(auth.error ?? 'Unauthorized')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('items')
    .update({
      deleted_at: null,
      deleted_by: null,
      updated_by: auth.profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .not('deleted_at', 'is', null)

  if (error) {
    logger.error({ operation: 'restoreItem', feature: 'items', userId: auth.profile.id, details: { id } }, error)
    return errorResponse('ไม่สามารถกู้คืนรายการได้ กรุณาลองใหม่อีกครั้ง')
  }

  // Log in audit logs
  await supabase.from('audit_logs').insert({
    user_id: auth.profile.id,
    action: 'restore',
    target_table: 'items',
    target_id: id,
    new_data: { deleted_at: null }
  })

  logger.info({ operation: 'restoreItem', feature: 'items', userId: auth.profile.id, details: { id } })

  revalidatePath('/items')
  revalidateSidebarCache()
  return successResponse('กู้คืนรายการเรียบร้อยแล้ว')
}

export async function bulkRestoreItems(ids: string[]): Promise<ActionResponse> {
  const auth = await requireDeletePermission()
  if (auth.error || !auth.profile) {
    logger.warn({ operation: 'bulkRestoreItems', feature: 'items', details: 'Unauthorized bulk restore attempt' })
    return errorResponse(auth.error ?? 'Unauthorized')
  }

  if (!ids.length) {
    return errorResponse('กรุณาเลือกรายการที่ต้องการกู้คืน')
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('items')
    .update({
      deleted_at: null,
      deleted_by: null,
      updated_by: auth.profile.id,
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .not('deleted_at', 'is', null)

  if (error) {
    logger.error({ operation: 'bulkRestoreItems', feature: 'items', userId: auth.profile.id, details: { ids } }, error)
    return errorResponse('ไม่สามารถกู้คืนรายการได้: ' + error.message)
  }

  // Log in audit logs
  const auditLogs = ids.map(id => ({
    user_id: auth.profile!.id,
    action: 'restore',
    target_table: 'items',
    target_id: id,
    new_data: { deleted_at: null }
  }))
  await supabase.from('audit_logs').insert(auditLogs)

  logger.info({ operation: 'bulkRestoreItems', feature: 'items', userId: auth.profile.id, details: { count: ids.length } })

  revalidatePath('/items')
  revalidateSidebarCache()
  return successResponse(`กู้คืนเรียบร้อย ${ids.length} รายการ`)
}

export async function hardDeleteItem(id: string): Promise<ActionResponse> {
  const auth = await requireDeletePermission()
  if (auth.error || !auth.profile) {
    logger.warn({ operation: 'hardDeleteItem', feature: 'items', details: 'Unauthorized hard delete attempt' })
    return errorResponse(auth.error ?? 'Unauthorized')
  }

  const supabase = await createClient()

  // ดึงข้อมูลก่อนลบ เพื่อเก็บลงประวัติและลบรูปออกจาก Storage ด้วย
  const { data: item } = await supabase
    .from('items')
    .select('image_url, item_name, asset_no, serial_no')
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .maybeSingle()

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .not('deleted_at', 'is', null)

  if (error) {
    logger.error({ operation: 'hardDeleteItem', feature: 'items', userId: auth.profile.id, details: { id } }, error)
    return errorResponse('ไม่สามารถลบรายการถาวรได้ กรุณาลองใหม่อีกครั้ง')
  }

  // Log in audit logs
  await supabase.from('audit_logs').insert({
    user_id: auth.profile.id,
    action: 'hard_delete',
    target_table: 'items',
    target_id: id,
    old_data: item || null
  })

  // ลบรูปออกจาก Storage (best effort)
  if (item?.image_url) {
    await deleteOldImage(item.image_url)
  }

  logger.info({ operation: 'hardDeleteItem', feature: 'items', userId: auth.profile.id, details: { id } })

  revalidatePath('/items')
  revalidateSidebarCache()
  return successResponse('ลบรายการถาวรเรียบร้อยแล้ว')
}

export async function bulkHardDeleteItems(ids: string[]): Promise<ActionResponse> {
  const auth = await requireDeletePermission()
  if (auth.error || !auth.profile) {
    logger.warn({ operation: 'bulkHardDeleteItems', feature: 'items', details: 'Unauthorized bulk hard delete attempt' })
    return errorResponse(auth.error ?? 'Unauthorized')
  }

  if (!ids.length) {
    return errorResponse('กรุณาเลือกรายการที่ต้องการลบถาวร')
  }

  const supabase = await createClient()

  // ดึงข้อมูลทั้งหมดก่อนลบ
  const { data: items } = await supabase
    .from('items')
    .select('image_url, item_name, asset_no, serial_no')
    .in('id', ids)
    .not('deleted_at', 'is', null)

  const { error } = await supabase
    .from('items')
    .delete()
    .in('id', ids)
    .not('deleted_at', 'is', null)

  if (error) {
    logger.error({ operation: 'bulkHardDeleteItems', feature: 'items', userId: auth.profile.id, details: { ids } }, error)
    return errorResponse('ไม่สามารถลบรายการถาวรได้: ' + error.message)
  }

  // Log in audit logs
  if (items && items.length > 0) {
    const auditLogs = items.map((item, idx) => ({
      user_id: auth.profile!.id,
      action: 'hard_delete',
      target_table: 'items',
      target_id: ids[idx],
      old_data: item
    }))
    await supabase.from('audit_logs').insert(auditLogs)
  }

  // ลบรูปออกจาก Storage (best effort)
  if (items) {
    await Promise.allSettled(items.map((item) => deleteOldImage(item.image_url)))
  }

  logger.info({ operation: 'bulkHardDeleteItems', feature: 'items', userId: auth.profile.id, details: { count: ids.length } })

  revalidatePath('/items')
  revalidateSidebarCache()
  return successResponse(`ลบถาวรเรียบร้อย ${ids.length} รายการ`)
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())

  return result.map((val) => {
    if (val.startsWith('"') && val.endsWith('"')) {
      return val.substring(1, val.length - 1).trim()
    }
    return val
  })
}

export async function importItemsBulk(csvContent: string): Promise<ActionResponse<{ count: number }>> {
  const timer = startTimer()
  const auth = await requireEditor()
  if (auth.error || !auth.profile) {
    logger.warn({ operation: 'importItemsBulk', feature: 'items', details: 'Unauthorized bulk import attempt' })
    return errorResponse(auth.error ?? 'Unauthorized')
  }

  // 1. Rate Limiting
  const rateLimitCheck = await checkRateLimit('importItemsBulk', 10, 60000)
  if (!rateLimitCheck.success) {
    return errorResponse(rateLimitCheck.error!)
  }

  // 2. Input size limits check (5MB)
  if (csvContent.length > 5 * 1024 * 1024) {
    return errorResponse('ขนาดไฟล์ข้อมูลนำเข้าใหญ่เกินกำหนด (สูงสุด 5MB)')
  }

  // Strip UTF-8 BOM if present
  const cleanContent = stripBom(csvContent)
  const lines = cleanContent.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length <= 1) {
    return errorResponse('ไม่พบข้อมูลในไฟล์ CSV')
  }

  // 3. Rows count check (1,000 data rows max)
  if (lines.length > 1001) {
    return errorResponse('จำนวนแถวข้อมูลเกินขีดจำกัด (สูงสุด 1,000 แถวต่อการนำเข้าหนึ่งครั้ง)')
  }

  try {
    const headers = parseCSVLine(lines[0]).map((h) => normalizeForSearch(h))
    if (!headers.includes('item_name')) {
      return errorResponse('ไม่พบหัวคอลัมน์ "item_name" (ชื่อสิ่งของ) กรุณาตรวจสอบไฟล์ของคุณว่ามีหัวตารางที่ถูกต้อง')
    }

    const rows = lines.slice(1)

    const itemsToInsert = []
    let lineNum = 1

    for (const row of rows) {
      lineNum++
      const cols = parseCSVLine(row)
      if (cols.length < headers.length) {
        return errorResponse(`บรรทัดที่ ${lineNum}: จำนวนคอลัมน์ไม่ครบถ้วน (พบ ${cols.length} คอลัมน์, ต้องการอย่างน้อย ${headers.length} คอลัมน์)`)
      }

      const getVal = (name: string) => {
        const idx = headers.indexOf(name)
        return idx !== -1 ? normalizeForStorage(cols[idx]) : ''
      }

      // Neutralize CSV injection formula characters
      const itemName = preventCSVInjection(getVal('item_name'))
      if (!itemName) {
        return errorResponse(`บรรทัดที่ ${lineNum}: ชื่อสิ่งของ (item_name) ห้ามว่าง`)
      }

      const itemType = getVal('item_type').toLowerCase() || 'asset'
      if (itemType !== 'asset' && itemType !== 'material' && itemType !== 'general') {
        return errorResponse(`บรรทัดที่ ${lineNum}: ประเภทสิ่งของ (item_type) ต้องเป็น asset, material หรือ general`)
      }

      const quantity = Math.max(1, parseInt(getVal('quantity')) || 1)
      const status = getVal('status').toLowerCase() || 'active'

      itemsToInsert.push({
        item_name: itemName,
        item_type: itemType,
        category_name: preventCSVInjection(getVal('category_name')),
        location_name: preventCSVInjection(getVal('location_name')),
        unit_name: preventCSVInjection(getVal('unit_name')),
        quantity,
        status,
        asset_no: preventCSVInjection(getVal('asset_no')) || null,
        serial_no: preventCSVInjection(getVal('serial_no')) || null,
        brand: preventCSVInjection(getVal('brand')) || null,
        model: preventCSVInjection(getVal('model')) || null,
        responsible_person: preventCSVInjection(getVal('responsible_person')) || null,
        note: preventCSVInjection(getVal('note')) || null,
      })
    }

    if (itemsToInsert.length === 0) {
      return errorResponse('ไม่พบแถวข้อมูลที่สามารถนำเข้าได้')
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('import_items_bulk_tx', {
      items_json: itemsToInsert,
      creator_id: auth.profile.id,
    })

    if (error) {
      logger.error({ operation: 'importItemsBulk', feature: 'items', userId: auth.profile.id }, error)
      return errorResponse('เกิดข้อผิดพลาดในการประมวลผลฐานข้อมูล: ' + error.message)
    }

    const res = data as { ok: boolean; count?: number; error?: string }
    if (!res.ok) {
      logger.warn({ operation: 'importItemsBulk', feature: 'items', userId: auth.profile.id, details: res.error })
      return errorResponse('เกิดข้อผิดพลาดขณะนำเข้าข้อมูล: ' + (res.error || 'ข้อผิดพลาดภายใน'))
    }

    // Centralized Audit Log
    await writeAuditLog({
      operation: 'import',
      feature: 'items',
      userId: auth.profile.id,
      targetType: 'items',
      newValues: { count: res.count },
    })

    const durationMs = timer.stop()
    const ctx = await getRequestContext(auth.profile.id)
    metrics.csvImport(res.count ?? 0)
    logger.info(withTraceContext(ctx, {
      operation: 'importItemsBulk',
      feature: 'items',
      action: 'importItemsBulk',
      userId: auth.profile.id,
      latency: durationMs,
      status: 'success',
      details: { count: res.count },
    }))

    revalidatePath('/items')
    revalidateSidebarCache()
    clearReferencesCache()
    return successResponse(`นำเข้าพัสดุสำเร็จ ${res.count} รายการ`, { count: res.count ?? 0 })
  } catch (err) {
    return handleActionError<{ count: number }>(err, 'importItemsBulk', 'items', auth.profile.id)
  }
}


export async function getItemsForExport(params: ItemListSearchParams) {
  const result = await getReportItemsList(params, true)
  return result.items
}

/**
 * Modal-friendly variant of createItem.
 * Identical logic but returns { ok: true } instead of redirecting,
 * so the NewItemSheet can close and refresh the list client-side.
 */
export async function createItemInline(
  _prevState: ActionResponse | null,
  formData: FormData
): Promise<ActionResponse> {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) {
    logger.warn({ operation: 'createItemInline', feature: 'items', details: 'Unauthorized inline create attempt' })
    return errorResponse(auth.error ?? 'Unauthorized')
  }

  formData.set('image_url', '')
  const initialParsed = parseFormData(formData)
  if (!initialParsed.success) {
    return errorResponse('กรุณาตรวจสอบข้อมูลในฟอร์ม', initialParsed.error.flatten().fieldErrors)
  }

  const uploadResult = await handleImageUpload(formData)
  if (uploadResult.error) {
    return errorResponse(uploadResult.error)
  }
  formData.set('image_url', uploadResult.imageUrl || '')

  const parsed = parseFormData(formData)
  if (!parsed.success) {
    if (uploadResult.imageUrl) {
      await deleteOldImage(uploadResult.imageUrl)
    }
    return errorResponse('กรุณาตรวจสอบข้อมูลในฟอร์ม', parsed.error.flatten().fieldErrors)
  }

  const supabase = await createClient()
  let newItem
  try {
    const { data, error } = await supabase
      .from('items')
      .insert({
        ...parsed.data,
        created_by: auth.profile.id,
        updated_by: auth.profile.id,
      })
      .select('id')
      .single()

    if (error || !data) {
      if (uploadResult.imageUrl) {
        await deleteOldImage(uploadResult.imageUrl)
      }
      return errorResponse(friendlyDatabaseError(error?.message || 'Database error'))
    }
    newItem = data

    await writeAuditLog({
      operation: 'create',
      feature: 'items',
      userId: auth.profile.id,
      targetType: 'items',
      targetId: newItem.id,
      newValues: parsed.data,
    })
  } catch (err) {
    if (uploadResult.imageUrl) {
      await deleteOldImage(uploadResult.imageUrl)
    }
    logger.error({ operation: 'createItemInline', feature: 'items', userId: auth.profile.id }, err)
    return errorResponse('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่ายหรือเข้าถึงฐานข้อมูล')
  }

  logger.info({ operation: 'createItemInline', feature: 'items', userId: auth.profile.id, details: { id: newItem.id } })

  revalidatePath('/items')
  revalidateSidebarCache()
  // Return successResponse — caller handles close + refresh
  return successResponse('สร้างพัสดุสำเร็จ')
}
