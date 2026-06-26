import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ItemListSearchParams, ItemListRow } from '@/features/items/types'


export async function getReportStats() {
  const supabase = await createClient()

  const [itemsResult, locationsResult] = await Promise.all([
    supabase
      .from('items')
      .select('item_type, status, quantity, category:categories(name)')
      .is('deleted_at', null),
    supabase
      .from('locations')
      .select('*', { count: 'exact', head: true })
  ])

  if (itemsResult.error) throw new Error(itemsResult.error.message)

  const items = itemsResult.data
  const locationCount = locationsResult.count || 0

  let totalItems = 0
  let totalQuantity = 0

  const typeCounts: Record<string, { count: number; qty: number }> = {
    asset: { count: 0, qty: 0 },
    material: { count: 0, qty: 0 },
    general: { count: 0, qty: 0 },
  }

  const statusCounts: Record<string, { count: number; qty: number }> = {
    active: { count: 0, qty: 0 },
    spare: { count: 0, qty: 0 },
    damaged: { count: 0, qty: 0 },
    waiting_repair: { count: 0, qty: 0 },
    inactive: { count: 0, qty: 0 },
    disposed: { count: 0, qty: 0 },
  }

  const categoryCounts: Record<string, { count: number; qty: number }> = {}

  for (const item of items ?? []) {
    const qty = item.quantity || 0
    totalItems += 1
    totalQuantity += qty

    if (item.item_type && typeCounts[item.item_type]) {
      typeCounts[item.item_type].count += 1
      typeCounts[item.item_type].qty += qty
    }

    if (item.status && statusCounts[item.status]) {
      statusCounts[item.status].count += 1
      statusCounts[item.status].qty += qty
    }

    const catObj = item.category as { name: string } | { name: string }[] | null
    const catName = Array.isArray(catObj) ? catObj[0]?.name : catObj?.name
    const safeCatName = catName || 'ทั่วไป'
    if (!categoryCounts[safeCatName]) {
      categoryCounts[safeCatName] = { count: 0, qty: 0 }
    }
    categoryCounts[safeCatName].count += 1
    categoryCounts[safeCatName].qty += qty
  }

  return {
    totalItems,
    totalQuantity,
    typeCounts,
    statusCounts,
    categoryCounts,
    locationCount,
  }
}

export async function getRecentAuditLogs() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      id,
      action,
      created_at,
      profiles:user_id(full_name),
      old_data,
      new_data
    `)
    .order('created_at', { ascending: false })
    .limit(8)

  if (error) {
    // Return empty array for non-admins (due to RLS read constraint)
    return []
  }

  return (data ?? []).map((log) => {
    const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles
    const oldData = log.old_data as Record<string, any> | null
    const newData = log.new_data as Record<string, any> | null
    const itemName = newData?.item_name || oldData?.item_name || 'พัสดุในระบบ'
    
    let actionLabel = log.action
    if (log.action === 'create') actionLabel = 'ขึ้นทะเบียนใหม่ (Created)'
    if (log.action === 'update') actionLabel = 'แก้ไขข้อมูล (Updated)'
    if (log.action === 'delete') actionLabel = 'ลบพัสดุ (Deleted)'

    const detailsText = newData?.responsible_person 
      ? `เปลี่ยนผู้รับผิดชอบเป็น ${newData.responsible_person}` 
      : (newData?.note || oldData?.note || `ปรับปรุงข้อมูลครุภัณฑ์รหัส ${newData?.asset_no || oldData?.asset_no || '-'}`)

    return {
      id: log.id,
      user: profile?.full_name || 'ผู้ใช้งานระบบ',
      action: actionLabel,
      itemName,
      details: detailsText,
      timestamp: log.created_at,
    }
  })
}


function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export interface ReportItemRow extends ItemListRow {
  brand: string | null
  model: string | null
}

export async function getReportItemsList(params: ItemListSearchParams): Promise<ReportItemRow[]> {
  const supabase = await createClient()
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
        brand,
        model,
        responsible_person,
        status,
        updated_at,
        category:categories(id, name),
        unit:units(id, name),
        location:locations(id, name)
      `
    )
    .is('deleted_at', null)

  if (q) {
    const safe = q.replaceAll(',', ' ')
    query = query.or(
      `item_name.ilike.%${safe}%,asset_no.ilike.%${safe}%,serial_no.ilike.%${safe}%,brand.ilike.%${safe}%,model.ilike.%${safe}%,responsible_person.ilike.%${safe}%`
    )
  }

  if (params.type) {
    query = query.eq('item_type', params.type)
  }

  if (params.status) {
    query = query.eq('status', params.status)
  }

  const { data, error } = await query.order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  
  const rawRows = data ?? []
  return rawRows.map((row) => {
    const r = row as {
      id: string
      item_name: string
      item_type: string
      quantity: number
      asset_no: string | null
      serial_no: string | null
      brand: string | null
      model: string | null
      responsible_person: string | null
      status: string
      updated_at: string
      category: unknown
      unit: unknown
      location: unknown
    }
    return {
      ...r,
      category: firstRelation(r.category as Record<string, unknown> | Record<string, unknown>[] | null),
      unit: firstRelation(r.unit as Record<string, unknown> | Record<string, unknown>[] | null),
      location: firstRelation(r.location as Record<string, unknown> | Record<string, unknown>[] | null),
    }
  }) as unknown as ReportItemRow[]
}
