'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { createClient } from '@/lib/supabase/server'
import { itemFormSchema } from './schema'
import { getReportItemsList } from '@/features/reports/queries'
import { ItemListSearchParams } from './types'

export interface ItemActionState {
  ok?: boolean
  message?: string
  fieldErrors?: Record<string, string[] | undefined>
}

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
      await supabase.storage.from('item-images').remove([filename])
    }
  } catch (error) {
    console.error('Failed to delete old image from storage:', error)
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
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const supabase = await createClient()

      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(fileName, Buffer.from(fileBuffer), {
          contentType: file.type,
        })

      if (uploadError) {
        return { imageUrl: null, error: 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ' }
      }

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
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return { message: auth.error ?? 'Unauthorized' }

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
  const { error } = await supabase.from('items').insert({
    ...parsed.data,
    created_by: auth.profile.id,
    updated_by: auth.profile.id,
  })

  if (error) {
    if (uploadResult.imageUrl) {
      await deleteOldImage(uploadResult.imageUrl)
    }
    return { message: friendlyDatabaseError(error.message) }
  }

  revalidatePath('/items')
  redirect('/items')
}

export async function updateItem(
  id: string,
  _prevState: ItemActionState | null,
  formData: FormData
): Promise<ItemActionState> {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return { message: auth.error ?? 'Unauthorized' }

  const supabase = await createClient()
  const { data: currentItem } = await supabase
    .from('items')
    .select('image_url')
    .eq('id', id)
    .single()

  const currentImageUrl = currentItem?.image_url || null

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

  if (uploadResult.oldImageUrlToDelete && uploadResult.oldImageUrlToDelete !== uploadResult.imageUrl) {
    await deleteOldImage(uploadResult.oldImageUrlToDelete)
  }

  revalidatePath('/items')
  revalidatePath(`/items/${id}`)
  redirect(`/items/${id}`)
}

export async function softDeleteItem(id: string) {
  const profile = await getCurrentProfile()

  if (!profile || profile.role !== 'admin') {
    return { message: 'เฉพาะผู้ดูแลระบบเท่านั้นที่ลบรายการได้' }
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
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')

  if (error) {
    console.error('[softDeleteItem] Supabase error:', error)
    return { message: 'ไม่สามารถลบรายการได้: ' + error.message }
  }

  // RLS block จะ return error=null แต่ data=[]
  if (!data || data.length === 0) {
    console.error('[softDeleteItem] 0 rows updated — possible RLS block or item not found. id:', id, 'role:', profile.role)
    return { message: 'ไม่สามารถลบรายการได้ (สิทธิ์ไม่เพียงพอหรือไม่พบรายการ)' }
  }

  revalidatePath('/items')
  redirect('/items')
}

export async function bulkUpdateItems(ids: string[], updates: { location_id?: string; status?: string }) {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return { message: auth.error ?? 'Unauthorized' }

  if (!ids.length) {
    return { message: 'กรุณาเลือกรายการที่ต้องการแก้ไข' }
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
    return { message: 'ไม่สามารถอัปเดตรายการได้: ' + error.message }
  }

  revalidatePath('/items')
  return { ok: true, message: `อัปเดตเรียบร้อย ${ids.length} รายการ` }
}

export async function bulkDeleteItems(ids: string[]) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') {
    return { message: 'เฉพาะผู้ดูแลระบบเท่านั้นที่ลบรายการได้' }
  }

  if (!ids.length) {
    return { message: 'กรุณาเลือกรายการที่ต้องการลบ' }
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
    console.error('[bulkDeleteItems] Supabase error:', error)
    return { message: 'ไม่สามารถลบรายการได้: ' + error.message }
  }

  if (!data || data.length === 0) {
    console.error('[bulkDeleteItems] 0 rows updated — possible RLS block. ids:', ids, 'role:', profile.role)
    return { message: 'ไม่สามารถลบรายการได้ (สิทธิ์ไม่เพียงพอหรือไม่พบรายการ)' }
  }

  revalidatePath('/items')
  return { ok: true, message: `ลบเรียบร้อย ${ids.length} รายการ` }
}

// ============================================================
// Trash: Restore & Hard Delete
// ============================================================

export async function restoreItem(id: string) {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return { message: auth.error ?? 'Unauthorized' }

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
    return { message: 'ไม่สามารถกู้คืนรายการได้ กรุณาลองใหม่อีกครั้ง' }
  }

  revalidatePath('/items')
  return { ok: true, message: 'กู้คืนรายการเรียบร้อยแล้ว' }
}

export async function bulkRestoreItems(ids: string[]) {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return { message: auth.error ?? 'Unauthorized' }

  if (!ids.length) {
    return { message: 'กรุณาเลือกรายการที่ต้องการกู้คืน' }
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
    return { message: 'ไม่สามารถกู้คืนรายการได้: ' + error.message }
  }

  revalidatePath('/items')
  return { ok: true, message: `กู้คืนเรียบร้อย ${ids.length} รายการ` }
}

export async function hardDeleteItem(id: string) {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return { message: auth.error ?? 'Unauthorized' }

  const supabase = await createClient()

  // ดึง image_url ก่อนลบ เพื่อลบรูปออกจาก Storage ด้วย
  const { data: item } = await supabase
    .from('items')
    .select('image_url')
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .maybeSingle()

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .not('deleted_at', 'is', null)

  if (error) {
    return { message: 'ไม่สามารถลบรายการถาวรได้ กรุณาลองใหม่อีกครั้ง' }
  }

  // ลบรูปออกจาก Storage (best effort)
  if (item?.image_url) {
    await deleteOldImage(item.image_url)
  }

  revalidatePath('/items')
  return { ok: true, message: 'ลบรายการถาวรเรียบร้อยแล้ว' }
}

export async function bulkHardDeleteItems(ids: string[]) {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return { message: auth.error ?? 'Unauthorized' }

  if (!ids.length) {
    return { message: 'กรุณาเลือกรายการที่ต้องการลบถาวร' }
  }

  const supabase = await createClient()

  // ดึง image_url ทั้งหมดก่อนลบ
  const { data: items } = await supabase
    .from('items')
    .select('image_url')
    .in('id', ids)
    .not('deleted_at', 'is', null)

  const { error } = await supabase
    .from('items')
    .delete()
    .in('id', ids)
    .not('deleted_at', 'is', null)

  if (error) {
    return { message: 'ไม่สามารถลบรายการถาวรได้: ' + error.message }
  }

  // ลบรูปออกจาก Storage (best effort)
  if (items) {
    await Promise.allSettled(items.map((item) => deleteOldImage(item.image_url)))
  }

  revalidatePath('/items')
  return { ok: true, message: `ลบถาวรเรียบร้อย ${ids.length} รายการ` }
}

export async function importItemsBulk(csvContent: string) {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return { message: auth.error ?? 'Unauthorized' }

  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length <= 1) {
    return { message: 'ไม่พบข้อมูลในไฟล์ CSV' }
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const rows = lines.slice(1)

  const supabase = await createClient()

  // Pre-fetch references
  const [categoriesRes, locationsRes, unitsRes] = await Promise.all([
    supabase.from('categories').select('id, name'),
    supabase.from('locations').select('id, name'),
    supabase.from('units').select('id, name'),
  ])

  const categoryMap = new Map(categoriesRes.data?.map((c) => [c.name.toLowerCase(), c.id]) ?? [])
  const locationMap = new Map(locationsRes.data?.map((l) => [l.name.toLowerCase(), l.id]) ?? [])
  const unitMap = new Map(unitsRes.data?.map((u) => [u.name.toLowerCase(), u.id]) ?? [])

  const itemsToInsert = []
  let lineNum = 1

  for (const row of rows) {
    lineNum++
    const cols = row.split(',').map((c) => c.trim())
    if (cols.length < headers.length) continue

    const getVal = (name: string) => {
      const idx = headers.indexOf(name)
      return idx !== -1 ? cols[idx] : ''
    }

    const itemName = getVal('item_name')
    if (!itemName) {
      return { message: `บรรทัดที่ ${lineNum}: ชื่อสิ่งของ (item_name) ห้ามว่าง` }
    }

    const itemType = getVal('item_type').toLowerCase() || 'asset'
    if (itemType !== 'asset' && itemType !== 'material' && itemType !== 'general') {
      return { message: `บรรทัดที่ ${lineNum}: ประเภทสิ่งของ (item_type) ต้องเป็น asset, material หรือ general` }
    }

    const categoryName = getVal('category_name')
    let categoryId = categoryMap.get(categoryName.toLowerCase()) || null
    if (categoryName && !categoryId) {
      const { data: newCat, error: catErr } = await supabase
        .from('categories')
        .insert({ name: categoryName, is_active: true })
        .select('id')
        .single()
      if (!catErr && newCat) {
        categoryId = newCat.id
        categoryMap.set(categoryName.toLowerCase(), categoryId)
      }
    }

    const locationName = getVal('location_name')
    let locationId = locationMap.get(locationName.toLowerCase()) || null
    if (locationName && !locationId) {
      const { data: newLoc, error: locErr } = await supabase
        .from('locations')
        .insert({ name: locationName, is_active: true })
        .select('id')
        .single()
      if (!locErr && newLoc) {
        locationId = newLoc.id
        locationMap.set(locationName.toLowerCase(), locationId)
      }
    }

    const unitName = getVal('unit_name')
    let unitId = unitMap.get(unitName.toLowerCase()) || null
    if (unitName && !unitId) {
      const { data: newUnit, error: unitErr } = await supabase
        .from('units')
        .insert({ name: unitName, is_active: true })
        .select('id')
        .single()
      if (!unitErr && newUnit) {
        unitId = newUnit.id
        unitMap.set(unitName.toLowerCase(), unitId)
      }
    }

    const quantity = Math.max(1, parseInt(getVal('quantity')) || 1)
    const status = getVal('status').toLowerCase() || 'active'

    itemsToInsert.push({
      item_name: itemName,
      item_type: itemType,
      category_id: categoryId,
      quantity,
      unit_id: unitId,
      asset_no: getVal('asset_no') || null,
      serial_no: getVal('serial_no') || null,
      brand: getVal('brand') || null,
      model: getVal('model') || null,
      location_id: locationId,
      responsible_person: getVal('responsible_person') || null,
      status,
      note: getVal('note') || null,
      created_by: auth.profile.id,
      updated_by: auth.profile.id,
    })
  }

  if (itemsToInsert.length === 0) {
    return { message: 'ไม่พบแถวข้อมูลที่สามารถนำเข้าได้' }
  }

  const { error } = await supabase.from('items').insert(itemsToInsert)
  if (error) {
    return { message: 'เกิดข้อผิดพลาดขณะบันทึกข้อมูลสิ่งของ: ' + error.message }
  }

  revalidatePath('/items')
  return { ok: true, message: `นำเข้าพัสดุสำเร็จ ${itemsToInsert.length} รายการ` }
}

export async function getItemsForExport(params: ItemListSearchParams) {
  return getReportItemsList(params)
}
