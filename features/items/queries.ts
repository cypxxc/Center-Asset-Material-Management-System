import 'server-only'

import { createClient } from '@/lib/supabase/server'
import {
  ItemDetail,
  ItemListResult,
  ItemListRow,
  ItemListSearchParams,
  ItemStatus,
  ItemType,
  ReferenceOption,
} from './types'

const PAGE_SIZE = 10

function parsePage(value: string | undefined) {
  const page = Number(value ?? '1')
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

function isItemType(value: string | undefined): value is ItemType {
  return value === 'material' || value === 'asset' || value === 'general'
}

function isItemStatus(value: string | undefined): value is ItemStatus {
  return (
    value === 'active' ||
    value === 'spare' ||
    value === 'damaged' ||
    value === 'waiting_repair' ||
    value === 'inactive' ||
    value === 'disposed'
  )
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function normalizeItemListRow(row: Omit<ItemListRow, 'category' | 'unit' | 'location'> & {
  category: ReferenceOption | ReferenceOption[] | null
  unit: ReferenceOption | ReferenceOption[] | null
  location: ReferenceOption | ReferenceOption[] | null
}): ItemListRow {
  return {
    ...row,
    category: firstRelation(row.category),
    unit: firstRelation(row.unit),
    location: firstRelation(row.location),
  }
}

function normalizeItemDetail(row: Omit<ItemDetail, 'category' | 'unit' | 'location'> & {
  category: ReferenceOption | ReferenceOption[] | null
  unit: ReferenceOption | ReferenceOption[] | null
  location: ReferenceOption | ReferenceOption[] | null
}): ItemDetail {
  return {
    ...row,
    category: firstRelation(row.category),
    unit: firstRelation(row.unit),
    location: firstRelation(row.location),
  }
}

export async function getItemReferences() {
  const supabase = await createClient()

  const [categories, locations, units] = await Promise.all([
    supabase.from('categories').select('id, name').eq('is_active', true).order('name'),
    supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
    supabase.from('units').select('id, name').eq('is_active', true).order('name'),
  ])

  return {
    categories: (categories.data ?? []) as ReferenceOption[],
    locations: (locations.data ?? []) as ReferenceOption[],
    units: (units.data ?? []) as ReferenceOption[],
  }
}

export async function getItems(params: ItemListSearchParams): Promise<ItemListResult> {
  const supabase = await createClient()
  const page = parsePage(params.page)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const q = params.q?.trim()

  let query = supabase
    .from('items')
    .select(
      `
        id,
        item_name,
        item_type,
        quantity,
        asset_no,
        serial_no,
        responsible_person,
        status,
        updated_at,
        brand,
        model,
        note,
        image_url,
        category:categories(id, name),
        unit:units(id, name),
        location:locations(id, name)
      `,
      { count: 'exact' }
    )

    .is('deleted_at', null)

  if (q) {
    const safe = q.replaceAll(',', ' ')
    query = query.or(
      `item_name.ilike.%${safe}%,asset_no.ilike.%${safe}%,serial_no.ilike.%${safe}%,brand.ilike.%${safe}%,model.ilike.%${safe}%,responsible_person.ilike.%${safe}%`
    )
  }

  if (isItemType(params.type)) {
    query = query.eq('item_type', params.type)
  }

  if (isItemStatus(params.status)) {
    query = query.eq('status', params.status)
  }

  const { data, count, error } = await query.order('updated_at', { ascending: false }).range(from, to)

  if (error) {
    throw new Error(error.message)
  }

  const total = count ?? 0

  return {
    items: ((data ?? []) as Parameters<typeof normalizeItemListRow>[0][]).map(normalizeItemListRow),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

export async function getItemById(id: string): Promise<ItemDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('items')
    .select(
      `
        id,
        item_name,
        item_type,
        quantity,
        asset_no,
        serial_no,
        brand,
        model,
        responsible_person,
        status,
        note,
        image_url,
        created_at,
        updated_at,
        category:categories(id, name),
        unit:units(id, name),
        location:locations(id, name)
      `
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? normalizeItemDetail(data as Parameters<typeof normalizeItemDetail>[0]) : null
}
