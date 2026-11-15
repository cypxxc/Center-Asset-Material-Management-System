'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { itemFormSchema } from './schema'
import { bulkEditSchema, BULK_EDIT_LIMIT } from './bulk-edit'
import type { ItemListSearchParams } from './types'
import { getItems } from './queries'
import { ActionResponse, successResponse, errorResponse } from '@/lib/actions-helper'
import { requireEditor, requireDeletePermission } from './auth-guard'
import { insertPostgresItem, getPostgresItemForUpdate, updatePostgresItem, mutatePostgresItems } from './postgres-actions'
import { uploadLocalItemImage, deleteLocalItemImage } from '@/lib/postgres/storage'
import { importItemsBulk as importItemsBulkCore, getItemsForExport as getItemsForExportCore } from './import-export-actions'
import { applyQualificationMapping as applyQualificationMappingCore, previewQualificationMapping as previewQualificationMappingCore } from './qualification-mapping'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { writeAuditLog } from '@/lib/audit'
import { syncCentralNote } from './central-note'

export type ItemActionState = ActionResponse
export async function importItemsBulk(csvContent: string): Promise<ActionResponse<{ count: number }>> { return importItemsBulkCore(csvContent) }
export async function getItemsForExport(params: ItemListSearchParams) { return getItemsForExportCore(params) }
export async function previewQualificationMapping() { return previewQualificationMappingCore() }
export async function applyQualificationMapping(expected: { eligible: number; qualified: number; belowThreshold: number }) {
  const result = await applyQualificationMappingCore(expected)
  revalidatePath('/items'); revalidatePath('/', 'layout'); revalidateTag(CACHE_TAGS.SIDEBAR_DATA, 'max')
  return result
}

function refreshItems() { revalidatePath('/items'); revalidatePath('/', 'layout'); revalidateTag(CACHE_TAGS.SIDEBAR_DATA, 'max'); revalidateTag(CACHE_TAGS.ITEM_REFERENCES, 'max') }
function parseFormData(formData: FormData) {
  const isCentral = ['true', 'on', '1'].includes(String(formData.get('is_central')))
  return itemFormSchema.safeParse({
    item_name: formData.get('item_name'), item_type: formData.get('item_type'), qualification_status: formData.get('qualification_status'),
    category_id: formData.get('category_id'), quantity: formData.get('quantity'), unit_price: formData.get('unit_price'), unit_id: formData.get('unit_id'),
    asset_no: formData.get('asset_no'), serial_no: formData.get('serial_no'), brand: formData.get('brand'), model: formData.get('model'),
    location_id: formData.get('location_id'), responsible_person: formData.get('responsible_person'), gfmis_number: formData.get('gfmis_number'),
    budget_source: formData.get('budget_source'), acquired_date: formData.get('acquired_date'), status: formData.get('status'), note: syncCentralNote(String(formData.get('note') ?? ''), isCentral),
    is_central: isCentral, image_url: formData.get('image_url'),
    depreciation_enabled: formData.get('depreciation_enabled'), depreciation_cost: formData.get('depreciation_cost'),
    depreciation_useful_life_years: formData.get('depreciation_useful_life_years'), depreciation_start_basis: formData.get('depreciation_start_basis'),
    depreciation_start_date: formData.get('depreciation_start_date'),
  })
}

async function imageForForm(formData: FormData, previous: string | null) {
  if (formData.get('remove_image') === 'true') return null
  const file = formData.get('image_file')
  if (!(file instanceof File) || file.size === 0) return previous
  return uploadLocalItemImage(file)
}

async function saveItem(formData: FormData, id?: string): Promise<ActionResponse<{ itemId?: string; intent?: string }>> {
  const auth = await requireEditor()
  if (auth.error || !auth.profile) return errorResponse(auth.error ?? 'Unauthorized')
  const previousResult = id ? await getPostgresItemForUpdate(id) : null
  if (previousResult?.error || (id && !previousResult?.data)) return errorResponse('ไม่พบรายการพัสดุ')
  const previousImage = previousResult?.data?.image_url ?? null
  let uploadedImage: string | null = null
  let persisted = false
  try {
    // Validate ordinary fields before creating a file on disk.
    formData.set('image_url', previousImage ?? '')
    const parsed = parseFormData(formData)
    if (!parsed.success) return errorResponse('กรุณาตรวจสอบข้อมูลในฟอร์ม', parsed.error.flatten().fieldErrors)
    const imageUrl = await imageForForm(formData, previousImage)
    if (imageUrl && imageUrl !== previousImage) uploadedImage = imageUrl
    parsed.data.image_url = imageUrl
    if (id) {
      const { error } = await updatePostgresItem(id, parsed.data)
      if (error) return errorResponse(error.message)
      persisted = true
      if (previousImage && previousImage !== imageUrl) await deleteLocalItemImage(previousImage, auth.profile)
    } else {
      const result = await insertPostgresItem(parsed.data)
      if (result.error || !result.data) return errorResponse(result.error?.message ?? 'บันทึกข้อมูลไม่สำเร็จ')
      persisted = true
      const itemId = String((result.data as { id: string }).id)
      refreshItems()
      return successResponse('สร้างพัสดุสำเร็จ', { itemId, intent: String(formData.get('intent') || 'save_and_close') })
    }
    await writeAuditLog({ operation: 'update', feature: 'items', userId: auth.profile.id, targetType: 'items', targetId: id, oldValues: previousResult?.data, newValues: parsed.data })
    refreshItems(); revalidatePath(`/items/${id}`)
    return successResponse('บันทึกการแก้ไขเรียบร้อยแล้ว')
  } catch (error) { return errorResponse(error instanceof Error ? error.message : 'บันทึกข้อมูลไม่สำเร็จ') }
  finally {
    if (uploadedImage && !persisted) await deleteLocalItemImage(uploadedImage, auth.profile)
  }
}

export async function createItem(_prevState: ItemActionState | null, formData: FormData): Promise<ItemActionState> {
  const result = await saveItem(formData)
  if (!result.success) return result
  if (formData.get('intent') === 'save_and_another') return result
  redirect('/items')
}
export async function createItemInline(_prevState: ActionResponse | null, formData: FormData): Promise<ActionResponse> { return saveItem(formData) }
export async function updateItem(id: string, _prevState: ItemActionState | null, formData: FormData): Promise<ItemActionState> {
  return saveItem(formData, id)
}
export async function updateItemConditionStatus(id: string, status: import('./types').ItemStatus): Promise<ActionResponse> {
  const parsed = bulkEditSchema.safeParse({ ids: [id], updates: { status } })
  if (!parsed.success) return errorResponse('กรุณาตรวจสอบรายการและช่องที่ต้องการแก้ไข')
  return mutatePostgresItems(parsed.data.ids, 'update', parsed.data.updates)
}
export async function getMatchingItemIds(params: ItemListSearchParams): Promise<ActionResponse<string[]>> {
  const auth = await requireEditor()
  if (auth.error) return errorResponse(auth.error)
  const ids: string[] = []
  for (let page = 1; ; page++) {
    const result = await getItems({ ...params, page: String(page), sort_by: 'item_name', sort_dir: 'asc' })
    if (result.total > BULK_EDIT_LIMIT) return errorResponse('เลือกได้ครั้งละไม่เกิน 1,000 รายการ กรุณากรองข้อมูลให้แคบลง')
    ids.push(...result.items.map(item => item.id))
    if (page >= result.totalPages) break
  }
  return successResponse('เลือกรายการแล้ว', [...new Set(ids)])
}
export async function bulkDeleteItems(ids: string[]): Promise<ActionResponse> {
  const auth = await requireDeletePermission()
  if (auth.error || !auth.profile) return errorResponse(auth.error ?? 'Unauthorized')
  return mutatePostgresItems(ids, 'delete')
}
export async function hardDeleteItem(id: string): Promise<ActionResponse> {
  const auth = await requireDeletePermission()
  if (auth.error || !auth.profile) return errorResponse(auth.error ?? 'Unauthorized')
  return mutatePostgresItems([id], 'delete')
}
export async function bulkHardDeleteItems(ids: string[]): Promise<ActionResponse> {
  const auth = await requireDeletePermission()
  if (auth.error || !auth.profile) return errorResponse(auth.error ?? 'Unauthorized')
  return mutatePostgresItems(ids, 'purge')
}
export async function recordPhysicalAuditAction(itemId: string, note?: string): Promise<{ success: boolean; error?: string; message?: string }> {
  const auth = await requireEditor()
  if (!auth.profile || auth.error) return { success: false, error: auth.error ?? 'Unauthorized' }
  await writeAuditLog({ operation: 'PHYSICAL_AUDIT', feature: 'items', targetType: 'items', targetId: itemId, userId: auth.profile.id, newValues: { status: 'verified', note: note?.trim() || 'ตรวจนับสภาพปกติ', inspector: auth.profile.full_name, audited_at: new Date().toISOString() } })
  revalidateTag(CACHE_TAGS.ITEMS, 'max'); revalidatePath(`/items/${itemId}`)
  return { success: true, message: 'บันทึกการตรวจนับครุภัณฑ์สำเร็จ' }
}
