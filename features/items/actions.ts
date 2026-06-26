'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { createClient } from '@/lib/supabase/server'
import { itemFormSchema } from './schema'

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
  const { error } = await supabase
    .from('items')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: profile.id,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) {
    return { message: 'ไม่สามารถลบรายการได้ กรุณาลองใหม่อีกครั้ง' }
  }

  revalidatePath('/items')
  redirect('/items')
}
