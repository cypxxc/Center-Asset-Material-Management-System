import 'server-only'
import { isPostgresBackend } from '@/lib/backend'
import { createClient } from '@/lib/supabase/server'
import {
  getPostgresDisbursements,
  getPostgresDisbursementById,
  getPostgresDisbursementSelectableItems,
} from './postgres-queries'
import type {
  DisbursementRow,
  DisbursementItemRow,
  DisbursementListResult,
  DisbursementSelectableItem,
} from './types'
import { disbursementListParamsSchema } from './schema'

export async function getDisbursements(paramsInput: unknown = {}): Promise<DisbursementListResult> {
  if (isPostgresBackend()) {
    return getPostgresDisbursements(paramsInput)
  }

  const params = disbursementListParamsSchema.parse(paramsInput)
  const supabase = await createClient()

  let query = supabase.from('disbursements').select('*', { count: 'exact' })

  if (params.q) {
    query = query.or(`document_no.ilike.%${params.q}%,recipient_name.ilike.%${params.q}%,department_name.ilike.%${params.q}%,purpose.ilike.%${params.q}%`)
  }
  if (params.status) {
    query = query.eq('status', params.status)
  }
  if (params.type) {
    query = query.eq('transaction_type', params.type)
  }

  const offset = (params.page - 1) * params.pageSize
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + params.pageSize - 1)

  if (error) throw new Error(error.message)
  const total = count ?? 0

  return {
    items: data ?? [],
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize) || 1,
  }
}

export async function getDisbursementById(id: string): Promise<(DisbursementRow & { items: DisbursementItemRow[] }) | null> {
  if (isPostgresBackend()) {
    return getPostgresDisbursementById(id)
  }

  const supabase = await createClient()
  const { data: doc, error: docErr } = await supabase
    .from('disbursements')
    .select('*')
    .eq('id', id)
    .single()

  if (docErr || !doc) return null

  const { data: items, error: itemsErr } = await supabase
    .from('disbursement_items')
    .select('*')
    .eq('disbursement_id', id)
    .order('id', { ascending: true })

  if (itemsErr) throw new Error(itemsErr.message)

  return {
    ...doc,
    items: items ?? [],
  }
}

export async function getDisbursementSelectableItems(): Promise<DisbursementSelectableItem[]> {
  if (isPostgresBackend()) {
    return getPostgresDisbursementSelectableItems()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('items')
    .select('id, item_name, item_type, asset_no, serial_no, quantity, category:categories(id, name), unit:units(name)')
    .is('deleted_at', null)
    .neq('status', 'disposed')
    .order('item_type', { ascending: true })
    .order('item_name', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data as unknown[]) || []).map((raw) => {
    const row = raw as {
      id: string
      item_name: string
      item_type: 'material' | 'asset'
      asset_no: string | null
      serial_no: string | null
      quantity: number
      category: { id: string; name: string } | { id: string; name: string }[] | null
      unit: { name: string } | { name: string }[] | null
    }
    return {
      id: row.id,
      item_name: row.item_name,
      item_type: row.item_type,
      asset_no: row.asset_no ?? null,
      serial_no: row.serial_no ?? null,
      quantity: Number(row.quantity) || 0,
      category: Array.isArray(row.category) ? row.category[0] : row.category ?? null,
      unit: Array.isArray(row.unit) ? row.unit[0] : row.unit ?? null,
    }
  })
}

