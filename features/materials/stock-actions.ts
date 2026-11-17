'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { getPostgresMaterialStockLedger, recordPostgresMaterialStock, returnPostgresMaterialStock } from './stock-postgres'

function refreshStock() {
  revalidatePath('/materials'); revalidatePath('/items'); revalidatePath('/disbursements'); revalidatePath('/', 'layout')
  revalidateTag(CACHE_TAGS.ITEMS, 'max'); revalidateTag(CACHE_TAGS.DISBURSEMENTS, 'max'); revalidateTag(CACHE_TAGS.SIDEBAR_DATA, 'max')
}

export async function saveMaterialStock(input: unknown) {
  try { const data = await recordPostgresMaterialStock(input); refreshStock(); return { success: true as const, data } }
  catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'บันทึกการเคลื่อนไหวไม่สำเร็จ' } }
}

export async function acceptMaterialReturn(input: unknown) {
  try { const data = await returnPostgresMaterialStock(input); refreshStock(); return { success: true as const, data } }
  catch (error) { return { success: false as const, error: error instanceof Error ? error.message : 'บันทึกการรับคืนไม่สำเร็จ' } }
}

export async function loadMaterialStock(itemId: string) {
  try { return { success: true as const, data: await getPostgresMaterialStockLedger(itemId) } }
  catch { return { success: false as const, error: 'โหลดบัญชีเคลื่อนไหวไม่สำเร็จ' } }
}
