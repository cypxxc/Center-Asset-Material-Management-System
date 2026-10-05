'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { createClient } from '@/lib/supabase/server'
import { deleteItemStorageImage } from '@/lib/supabase/storage'
import { itemFormSchema } from './schema'
import { bulkEditSchema, BULK_EDIT_LIMIT, type BulkItemUpdates } from './bulk-edit'
import { getItems } from './queries'
import { ItemListSearchParams } from './types'
import { normalizeForSearch } from '@/lib/unicode'
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
import { isPostgresBackend } from '@/lib/backend'
import { insertPostgresItem, getPostgresItemForUpdate, updatePostgresItem, mutatePostgresItems } from './postgres-actions'
import { uploadLocalItemImage } from '@/lib/postgres/storage'
import { requireEditor, requireDeletePermission } from './auth-guard'
import {
  importItemsBulk as importItemsBulkCore,
  getItemsForExport as getItemsForExportCore,
} from './import-export-actions'

export type ItemActionState = ActionResponse

export async function importItemsBulk(csvContent: string): Promise<ActionResponse<{ count: number }>> {
  return importItemsBulkCore(csvContent)
}

export async function getItemsForExport(params: ItemListSearchParams) {
  return getItemsForExportCore(params)
}

// Bust sidebar data cache (layout scope) whenever items change
function revalidateSidebarCache() {
  revalidateTag(CACHE_TAGS.SIDEBAR_DATA, 'max')
  revalidatePath('/', 'layout')
}

function parseFormData(formData: FormData) {
  return itemFormSchema.safeParse({
    item_name: formData.get('item_name'),
    item_type: formData.get('item_type'),
    category_id: formData.get('category_id'),
    quantity: formData.get('quantity'),
    unit_price: formData.get('unit_price'),
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
    depreciation_enabled: formData.get('depreciation_enabled'),
    depreciation_cost: formData.get('depreciation_cost'),
    depreciation_useful_life_years: formData.get('depreciation_useful_life_years'),
    depreciation_start_basis: formData.get('depreciation_start_basis'),
    depreciation_start_date: formData.get('depreciation_start_date'),
  })
}

function friendlyDatabaseError(message: string) {
  if (message.includes('unique_asset_no_not_deleted') || message.includes('unique_asset_no_active')) {
    return 'เลขครุภัณฑ์นี้มีอยู่ในระบบแล้ว'
  }

  if (message.includes('unique_serial_no_not_deleted')) {
    return 'Serial Number นี้มีอยู่ในระบบแล้ว'
  }

  return 'ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบข้อมูลอีกครั้ง'
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
    if (file.size > 5 * 1024 * 1024) {
      return { imageUrl: null, error: 'ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB' }
    }

    try {
      const fileBuffer = await file.arrayBuffer()
      const bytes = Buffer.from(fileBuffer)

      // Strict magic bytes verification to prevent MIME/extension spoofing
      let detectedExt: 'jpg' | 'png' | 'webp' | null = null
      let detectedMime = ''
      if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) {
        detectedExt = 'jpg'
        detectedMime = 'image/jpeg'
      } else if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        detectedExt = 'png'
        detectedMime = 'image/png'
      } else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
        detectedExt = 'webp'
        detectedMime = 'image/webp'
      }

      if (!detectedExt) {
        return { imageUrl: null, error: 'กรุณาอัปโหลดไฟล์รูปภาพประเภท JPEG, PNG หรือ WEBP เท่านั้น' }
      }

      if (isPostgresBackend()) {
        const verifiedFile = new File([fileBuffer], `${crypto.randomUUID()}.${detectedExt}`, { type: detectedMime })
        return { imageUrl: await uploadLocalItemImage(verifiedFile), oldImageUrlToDelete: currentImageUrl }
      }

      const fileName = `${crypto.randomUUID()}.${detectedExt}`
      const supabase = await createClient()

      await retryStorage(async () => {
        const result = await supabase.storage.from('item-images').upload(fileName, bytes, {
          contentType: detectedMime,
        })
        if (result.error) throw result.error
        return result
      })

      const { data: { publicUrl } } = supabase.storage
        .from('item-images')
        .getPublicUrl(fileName)

      return { imageUrl: publicUrl, oldImageUrlToDelete: currentImageUrl }
    } catch (error) {
      logger.error({
        operation: 'uploadItemImage',
        feature: 'items',
        details: 'Failed to process or upload item image',
      }, error)
      return { imageUrl: null, error: 'เกิดข้อผิดพลาดในการประมวลผลไฟล์รูปภาพ' }
    }
  }

  return { imageUrl: currentImageUrl }
}

type CreateItemCoreResult =
  | { ok: true; itemId: string; userId: string }
  | {
      ok: false
      kind: 'auth' | 'validation' | 'upload' | 'database' | 'unexpected'
      message: string
      fieldErrors?: ActionResponse['fieldErrors']
      error?: unknown
      userId?: string
    }

type CreateItemCoreOptions = {
  afterAuthorize?: (userId: string) => Promise<{ message: string } | null>
  onCommitted?: (result: { itemId: string; userId: string }) => Promise<void>
}

async function createItemCore(
  formData: FormData,
  options: CreateItemCoreOptions = {},
): Promise<CreateItemCoreResult> {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) {
    return { ok: false, kind: 'auth', message: auth.error ?? 'Unauthorized' }
  }

  const userId = auth.profile.id
  const authorizationFollowUp = await options.afterAuthorize?.(userId)
  if (authorizationFollowUp) {
    return { ok: false, kind: 'unexpected', message: authorizationFollowUp.message, userId }
  }

  formData.set('image_url', '')
  const initialParsed = parseFormData(formData)
  if (!initialParsed.success) {
    return {
      ok: false,
      kind: 'validation',
      message: 'กรุณาตรวจสอบข้อมูลในฟอร์ม',
      fieldErrors: initialParsed.error.flatten().fieldErrors,
      userId,
    }
  }

  const uploadResult = await handleImageUpload(formData)
  if (uploadResult.error) {
    return { ok: false, kind: 'upload', message: uploadResult.error, userId }
  }
  formData.set('image_url', uploadResult.imageUrl || '')

  let uploadedImageDeleted = false
  async function deleteUploadedImage() {
    if (!uploadResult.imageUrl || uploadedImageDeleted) return
    uploadedImageDeleted = true
    await deleteItemStorageImage(uploadResult.imageUrl, auth.profile)
  }

  const parsed = parseFormData(formData)
  if (!parsed.success) {
    await deleteUploadedImage()
    return {
      ok: false,
      kind: 'validation',
      message: 'กรุณาตรวจสอบข้อมูลในฟอร์ม',
      fieldErrors: parsed.error.flatten().fieldErrors,
      userId,
    }
  }

  const supabase = isPostgresBackend() ? null : await createClient()
  let committedResult: { itemId: string; userId: string }
  let isCommitted = false
  try {
    const assetNumberSource = parsed.data.item_type === 'asset' ? 'manual' : null
    const result = isPostgresBackend() ? await insertPostgresItem(parsed.data) : await supabase!
      .from('items')
      .insert({
        ...parsed.data,
        created_by: userId,
        updated_by: userId,
        asset_number_source: assetNumberSource,
        asset_number_template_id: null,
        asset_number_payload: null,
        depreciation_method: parsed.data.depreciation_enabled ? 'straight_line' : null,
        depreciation_residual_value: 1,
      })
      .select('id')
      .single()

    const { data, error } = result

    if (error || !data) {
      await deleteUploadedImage()
      return {
        ok: false,
        kind: 'database',
        message: friendlyDatabaseError(error?.message || 'Database error'),
        userId,
      }
    }

    isCommitted = true
    committedResult = { itemId: (data as { id: string }).id, userId }

    await writeAuditLog({
      operation: 'create',
      feature: 'items',
      userId,
      targetType: 'items',
      targetId: (data as { id: string }).id,
      newValues: { ...parsed.data, ...(assetNumberSource ? { asset_number_source: assetNumberSource } : {}) },
      persistToDatabase: false,
    })

    await options.onCommitted?.(committedResult)
  } catch (err) {
    if (!isCommitted) {
      await deleteUploadedImage()
    }
    return {
      ok: false,
      kind: 'unexpected',
      message: 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่ายหรือเข้าถึงฐานข้อมูล',
      error: err,
      userId,
    }
  }

  revalidatePath('/items')
  revalidateSidebarCache()
  return { ok: true, ...committedResult }
}

export async function createItem(
  _prevState: ItemActionState | null,
  formData: FormData
): Promise<ItemActionState> {
  const timer = startTimer()
  const result = await createItemCore(formData, {
    afterAuthorize: async () => {
      const rateLimitCheck = await checkRateLimit('createItem', 30, 60000)
      return rateLimitCheck.success ? null : { message: rateLimitCheck.error! }
    },
    onCommitted: async ({ userId }) => {
      const durationMs = timer.stop()
      const ctx = await getRequestContext(userId)
      metrics.itemCreated()
      logger.info(withTraceContext(ctx, {
        operation: 'createItem',
        feature: 'items',
        action: 'createItem',
        userId,
        latency: durationMs,
        status: 'success',
      }))
    },
  })

  if (!result.ok) {
    if (result.kind !== 'unexpected' || result.error === undefined) {
      return result.fieldErrors
        ? { message: result.message, fieldErrors: result.fieldErrors }
        : { message: result.message }
    }
    const errRes = await handleActionError(result.error, 'createItem', 'items', result.userId)
    return { message: errRes.message! }
  }

  redirect('/items')
}

export async function updateItem(
  id: string,
  _prevState: ItemActionState | null,
  formData: FormData
): Promise<ItemActionState> {
  const timer = startTimer()
  const supabase = isPostgresBackend() ? null : await createClient()

  let auth
  let oldItem = null

  try {
    // Run authentication check and database old item fetch in parallel to minimize network latency
    const [authResult, oldItemResult] = await Promise.all([
      requireEditor(),
      isPostgresBackend() ? getPostgresItemForUpdate(id) : supabase!
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
      await deleteItemStorageImage(uploadResult.imageUrl, auth.profile)
    }
    return {
      message: 'กรุณาตรวจสอบข้อมูลในฟอร์ม',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    const { error } = isPostgresBackend() ? await updatePostgresItem(id, parsed.data) : await supabase!
      .from('items')
      .update({
        ...parsed.data,
        depreciation_method: parsed.data.depreciation_enabled ? 'straight_line' : null,
        depreciation_residual_value: 1,
        updated_by: auth.profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) {
      if (uploadResult.imageUrl && uploadResult.imageUrl !== currentImageUrl) {
        await deleteItemStorageImage(uploadResult.imageUrl, auth.profile)
      }
      return { message: friendlyDatabaseError(error.message) }
    }

    if (oldItem) {
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
        persistToDatabase: false,
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
      await deleteItemStorageImage(uploadResult.imageUrl, auth.profile)
    }
    const errRes = await handleActionError(err, 'updateItem', 'items', auth.profile.id)
    return { message: errRes.message! }
  }

  if (uploadResult.oldImageUrlToDelete && uploadResult.oldImageUrlToDelete !== uploadResult.imageUrl) {
    // Non-blocking image deletion with resolved profile to avoid cookies() outside request context
    const oldUrl = uploadResult.oldImageUrlToDelete
    const profile = auth.profile
    setImmediate(async () => {
      try {
        await deleteItemStorageImage(oldUrl, profile)
      } catch (err) {
        logger.warn({ operation: 'deleteOldImage', feature: 'items', details: String(err), imageUrl: oldUrl })
      }
    })
  }

  revalidatePath('/items')
  revalidateSidebarCache()
  revalidatePath(`/items/${id}`)
  if (formData.get('inline') === 'true') {
    return successResponse('บันทึกการแก้ไขเรียบร้อยแล้ว')
  }
  redirect(`/items/${id}`)
}

export async function bulkUpdateItems(ids: string[], updates: BulkItemUpdates): Promise<ActionResponse> {
  const parsed = bulkEditSchema.safeParse({ ids, updates })
  if (!parsed.success) return errorResponse('กรุณาเลือกรายการไม่เกิน 1,000 รายการ และตรวจสอบช่องที่ต้องการแก้ไข')
  if (isPostgresBackend()) return mutatePostgresItems(parsed.data.ids, 'update', parsed.data.updates)
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return errorResponse(auth.error ?? 'Unauthorized')
  const rate = await checkRateLimit('items-bulk-update', 30, 60000)
  if (!rate.success) return errorResponse(rate.error!)
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('bulk_update_items_tx', {
      p_ids: parsed.data.ids, p_updates: parsed.data.updates,
    })
    if (error) {
      logger.error({ operation: 'bulkUpdateItems', feature: 'items', userId: auth.profile.id }, error)
      return errorResponse('บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลและลองใหม่')
    }
    const count = Number(data)
    if (!Number.isInteger(count) || count <= 0) return errorResponse('ไม่พบรายการที่สามารถแก้ไขได้ กรุณาเลือกใหม่')
    await writeAuditLog({
      operation: 'bulk_update',
      feature: 'items',
      userId: auth.profile.id,
      targetType: 'items',
      newValues: { ids: parsed.data.ids, updates: parsed.data.updates, count },
    })
    revalidatePath('/items')
    revalidateSidebarCache()
    return successResponse(`แก้ไขสำเร็จ ${count} จาก ${parsed.data.ids.length} รายการ`)
  } catch (error) { return handleActionError(error, 'bulkUpdateItems', 'items') }
}

export async function getMatchingItemIds(params: ItemListSearchParams): Promise<ActionResponse<string[]>> {
  const auth = await requireEditor()
  if (auth.error) return errorResponse(auth.error)
  try {
    const ids: string[] = []
    if (isPostgresBackend()) {
      for (let page = 1; ; page++) {
        const result = await getItems({ ...params, page: String(page), sort_by: 'item_name', sort_dir: 'asc' })
        if (result.total > BULK_EDIT_LIMIT) return errorResponse('เลือกได้ครั้งละไม่เกิน 1,000 รายการ กรุณากรองข้อมูลให้แคบลง')
        ids.push(...result.items.map(item => item.id))
        if (page >= result.totalPages) break
      }
    } else {
      const supabase = await createClient()
      for (let offset = 0; ; offset += 500) {
        let query = supabase.from('items').select('id', { count: 'exact' }).is('deleted_at', null)
        const q = normalizeForSearch(params.q || '').replaceAll(',', ' ')
        if (q) query = query.or(`item_name.ilike.%${q}%,asset_no.ilike.%${q}%,serial_no.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%,responsible_person.ilike.%${q}%`)
        if (params.type === 'asset' || params.type === 'material') query = query.eq('item_type', params.type)
        if (params.status && ['active','spare','damaged','waiting_repair','inactive','disposed'].includes(params.status)) query = query.eq('status', params.status)
        if (params.category_id) query = query.eq('category_id', params.category_id)
        if (params.location_id) query = query.eq('location_id', params.location_id)
        const { data, count, error } = await query.order('id').range(offset, offset + 499)
        if (error) throw error
        if ((count ?? 0) > BULK_EDIT_LIMIT) return errorResponse('เลือกได้ครั้งละไม่เกิน 1,000 รายการ กรุณากรองข้อมูลให้แคบลง')
        ids.push(...(data ?? []).map(item => item.id))
        if (offset + 500 >= (count ?? 0)) break
      }
    }
    return successResponse('เลือกรายการแล้ว', [...new Set(ids)])
  } catch { return errorResponse('เลือกรายการไม่สำเร็จ กรุณาลองใหม่') }
}

export async function bulkDeleteItems(ids: string[]): Promise<ActionResponse> {
  const auth = await requireDeletePermission()
  if (auth.error || !auth.profile) {
    logger.warn({ operation: 'bulkDeleteItems', feature: 'items', details: 'Unauthorized bulk delete attempt' })
    return errorResponse(auth.error ?? 'Unauthorized')
  }

  if (isPostgresBackend()) return mutatePostgresItems(ids, 'delete')

  if (!ids.length) {
    return errorResponse('กรุณาเลือกรายการที่ต้องการลบ')
  }

  const supabase = await createClient()
  const { data: itemsToDelete, error: lookupError } = await supabase
    .from('items')
    .select('id, image_url')
    .in('id', ids)
    .is('deleted_at', null)

  if (lookupError) {
    return errorResponse('ไม่สามารถเตรียมลบรายการได้ กรุณาลองใหม่อีกครั้ง')
  }

  const { error, data } = await supabase
    .from('items')
    .delete()
    .in('id', ids)
    .is('deleted_at', null)
    .select('id')

  if (error) {
    logger.error({ operation: 'bulkDeleteItems', feature: 'items', userId: auth.profile.id, details: { ids } }, error)
    return errorResponse('ไม่สามารถลบรายการได้: ' + error.message)
  }

  if (!data || data.length === 0) {
    logger.warn({ operation: 'bulkDeleteItems', feature: 'items', userId: auth.profile.id, details: '0 rows updated - RLS block or already deleted' })
    return errorResponse('ไม่สามารถลบรายการได้ (สิทธิ์ไม่เพียงพอหรือไม่พบรายการ)')
  }

  await Promise.allSettled((itemsToDelete ?? []).map((item) => deleteItemStorageImage(item.image_url, auth.profile)))

  await writeAuditLog({
    operation: 'delete',
    feature: 'items',
    userId: auth.profile.id,
    targetType: 'items',
    newValues: { ids, count: ids.length },
  })

  logger.info({ operation: 'bulkDeleteItems', feature: 'items', userId: auth.profile.id, details: { count: ids.length } })

  revalidatePath('/items')
  revalidateSidebarCache()
  return successResponse(`ลบเรียบร้อย ${ids.length} รายการ`)
}

export async function hardDeleteItem(id: string): Promise<ActionResponse> {
  const auth = await requireDeletePermission()
  if (auth.error || !auth.profile) {
    logger.warn({ operation: 'hardDeleteItem', feature: 'items', details: 'Unauthorized hard delete attempt' })
    return errorResponse(auth.error ?? 'Unauthorized')
  }
  if (isPostgresBackend()) return mutatePostgresItems([id], 'delete')

  const supabase = await createClient()

  // ดึงข้อมูลก่อนลบ เพื่อเก็บลงประวัติและลบรูปออกจาก Storage ด้วย
  const { data: item } = await supabase
    .from('items')
    .select('image_url, item_name, asset_no, serial_no')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .is('deleted_at', null)

  if (error) {
    logger.error({ operation: 'hardDeleteItem', feature: 'items', userId: auth.profile.id, details: { id } }, error)
    return errorResponse('ไม่สามารถลบรายการถาวรได้ กรุณาลองใหม่อีกครั้ง')
  }

  // ลบรูปออกจาก Storage (best effort)
  if (item?.image_url) {
    await deleteItemStorageImage(item.image_url, auth.profile)
  }

  await writeAuditLog({
    operation: 'hard_delete',
    feature: 'items',
    userId: auth.profile.id,
    targetType: 'items',
    targetId: id,
    oldValues: item,
  })

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
  if (isPostgresBackend()) return mutatePostgresItems(ids, 'purge')

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

  // ลบรูปออกจาก Storage (best effort)
  if (items) {
    await Promise.allSettled(items.map((item) => deleteItemStorageImage(item.image_url, auth.profile)))
  }

  await writeAuditLog({
    operation: 'bulk_hard_delete',
    feature: 'items',
    userId: auth.profile.id,
    targetType: 'items',
    newValues: { ids, count: ids.length },
  })

  logger.info({ operation: 'bulkHardDeleteItems', feature: 'items', userId: auth.profile.id, details: { count: ids.length } })

  revalidatePath('/items')
  revalidateSidebarCache()
  return successResponse(`ลบถาวรเรียบร้อย ${ids.length} รายการ`)
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
  const result = await createItemCore(formData)
  if (!result.ok) {
    if (result.kind === 'auth') {
      logger.warn({ operation: 'createItemInline', feature: 'items', details: 'Unauthorized inline create attempt' })
    }
    if (result.kind === 'unexpected' && result.error !== undefined) {
      logger.error({ operation: 'createItemInline', feature: 'items', userId: result.userId }, result.error)
    }
    return errorResponse(result.message, result.fieldErrors)
  }

  logger.info({ operation: 'createItemInline', feature: 'items', userId: result.userId, details: { id: result.itemId } })
  // Return successResponse — caller handles close + refresh
  return successResponse('สร้างพัสดุสำเร็จ')
}

/**
 * Records a physical inventory inspection / audit check-in for an asset.
 */
export async function recordPhysicalAuditAction(
  itemId: string,
  note?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!itemId || typeof itemId !== 'string' || !itemId.trim()) {
    return { success: false, error: 'รหัสพัสดุไม่ถูกต้อง' }
  }

  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active) {
    return { success: false, error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' }
  }

  const timestamp = new Date().toISOString()
  const auditNote = typeof note === 'string' ? note.trim() || 'ตรวจนับสภาพปกติ' : 'ตรวจนับสภาพปกติ'

  await writeAuditLog({
    operation: 'PHYSICAL_AUDIT',
    feature: 'items',
    targetType: 'items',
    targetId: itemId,
    userId: profile.id,
    newValues: {
      status: 'verified',
      note: auditNote,
      inspector: profile.full_name,
      audited_at: timestamp,
    },
    timestamp,
  })

  revalidateTag(CACHE_TAGS.ITEMS, 'max')
  revalidatePath(`/items/${itemId}`)

  return {
    success: true,
    message: 'บันทึกการตรวจนับครุภัณฑ์สำเร็จ',
  }
}

