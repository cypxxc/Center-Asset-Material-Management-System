'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireEditor } from '@/features/items/auth-guard'
import { itemFormSchema } from '@/features/items/schema'
import { materialLedgerSchema } from '@/features/items/material-fields'
import { insertPostgresItem, updatePostgresItem } from '@/features/items/postgres-actions'
import { getMaterial } from './queries'

export type MaterialActionState = { error?: string; success?: boolean; itemId?: string }

export async function saveMaterialInline(id: string | null, _state: MaterialActionState | null, form: FormData): Promise<MaterialActionState> {
  const auth = await requireEditor()
  if (auth.error) return { error: auth.error }
  const previous = id ? await getMaterial(id) : null
  if (id && !previous) return { error: 'ไม่พบวัสดุ' }
  const raw = Object.fromEntries(form)
  const common = itemFormSchema.safeParse({ ...previous, ...raw, quantity: previous ? previous.quantity : raw.quantity, item_type: 'material', depreciation_enabled: false,
    qualification_status: null, is_central: true,
    category_id: raw.category_id || undefined, unit_id: raw.unit_id || undefined, location_id: raw.location_id || undefined,
    image_url: previous?.image_url ?? '' })
  const ledger = materialLedgerSchema.safeParse(raw)
  if (!common.success || !ledger.success) {
    return { error: [!common.success ? common.error.issues[0]?.message : '', !ledger.success ? `${ledger.error.issues[0]?.path.join('.')}: ${ledger.error.issues[0]?.message}` : ''].filter(Boolean).join(' · ') }
  }
  const result = id ? { ...await updatePostgresItem(id,common.data,ledger.data,Number(form.get('metadata_version'))), data: { id } } : await insertPostgresItem(common.data,ledger.data)
  if (result.error) return { error: result.error.message }
  revalidatePath('/materials'); revalidatePath('/', 'layout')
  return { success: true, itemId: result.data?.id }
}

export async function saveMaterial(id: string | null, state: MaterialActionState | null, form: FormData): Promise<MaterialActionState> {
  const result = await saveMaterialInline(id, state, form)
  if (result.error) return result
  redirect('/materials')
}
