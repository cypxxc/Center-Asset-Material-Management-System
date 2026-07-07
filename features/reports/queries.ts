import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { ItemListSearchParams, ItemListRow } from '@/features/items/types'
import { normalizeForSearch } from '@/lib/unicode'
import { getItemValue } from '@/lib/utils'
import { measureQuery } from '@/lib/performance'

export interface ReportCountBucket {
  count: number
  qty: number
}

export interface ReportStats {
  totalItems: number
  totalQuantity: number
  typeCounts: Record<string, ReportCountBucket>
  statusCounts: Record<string, ReportCountBucket>
  categoryCounts: Record<string, ReportCountBucket>
  locationCount: number
}

export interface RecentAuditLog {
  id: string
  user: string
  action: string
  itemName: string
  details: string
  timestamp: string
}

export async function getReportStats(): Promise<ReportStats> {
  const supabase = await createClient()
  const {
    result: { data, error },
  } = await measureQuery('reports.getReportStats', () => supabase.rpc('get_report_stats'))

  if (error || !data) {
    if (error) throw new Error(error.message)
    return {
      totalItems: 0,
      totalQuantity: 0,
      typeCounts: {
        asset: { count: 0, qty: 0 },
        material: { count: 0, qty: 0 },
      },
      statusCounts: {},
      categoryCounts: {},
      locationCount: 0,
    }
  }

  const res = data as {
    total_items: number
    total_quantity: number
    type_counts: Record<string, { count: number; qty: number }>
    status_counts: Record<string, { count: number; qty: number }>
    category_counts: Record<string, { count: number; qty: number }>
    location_count: number
  }

  return {
    totalItems: res.total_items,
    totalQuantity: res.total_quantity,
    typeCounts: {
      asset: res.type_counts.asset ?? { count: 0, qty: 0 },
      material: res.type_counts.material ?? { count: 0, qty: 0 },
    },
    statusCounts: res.status_counts,
    categoryCounts: res.category_counts,
    locationCount: res.location_count,
  }
}

export async function getRecentAuditLogs(): Promise<RecentAuditLog[]> {
  const supabase = await createClient()
  const {
    result: { data, error },
  } = await measureQuery('reports.getRecentAuditLogs', () =>
    supabase
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
  )

  if (error) {
    // Return empty array for non-admins (due to RLS read constraint)
    return []
  }

  return (data ?? []).map((log) => {
    const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles
    interface AuditLogPayload {
      item_name?: string
      responsible_person?: string
      note?: string
      asset_no?: string
    }
    const oldData = log.old_data as AuditLogPayload | null
    const newData = log.new_data as AuditLogPayload | null
    const itemName = newData?.item_name || oldData?.item_name || 'พัสดุในระบบ'
    
    let actionLabel = log.action
    if (log.action === 'create') actionLabel = 'ขึ้นทะเบียนใหม่ (Created)'
    if (log.action === 'update') actionLabel = 'แก้ไขข้อมูล (Updated)'
    if (log.action === 'delete') actionLabel = 'ลบพัสดุลงถังขยะ (Deleted)'
    if (log.action === 'restore') actionLabel = 'กู้คืนพัสดุ (Restored)'
    if (log.action === 'hard_delete') actionLabel = 'ลบพัสดุถาวร (Hard Deleted)'

    let detailsText = newData?.responsible_person 
      ? `เปลี่ยนผู้รับผิดชอบเป็น ${newData.responsible_person}` 
      : (newData?.note || oldData?.note || `ปรับปรุงข้อมูลครุภัณฑ์รหัส ${newData?.asset_no || oldData?.asset_no || '-'}`)

    if (log.action === 'restore') {
      detailsText = 'กู้คืนสิ่งของกลับสู่ระบบหลักสำเร็จ'
    } else if (log.action === 'hard_delete') {
      detailsText = `ลบข้อมูลสิ่งของออกจากระบบแบบถาวร (รหัสครุภัณฑ์ ${oldData?.asset_no || '-'})`
    }

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

export interface ReportListResult {
  items: ReportItemRow[]
  totalCount: number
  totalQuantity: number
  totalValue: number
  totalPages: number
  page: number
  auditedCount: number
  overdueAuditItems: ReportItemRow[]
}

interface ReportItemsPageRpcResponse {
  items?: unknown[]
  total_count?: number
  total_quantity?: number
  total_value?: number
  total_pages?: number
  page?: number
  audited_count?: number
  overdue_audit_items?: unknown[]
}

function toReportItemRow(row: unknown): ReportItemRow {
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
  } as unknown as ReportItemRow
}

async function getReportItemsPageViaRpc(
  params: ItemListSearchParams,
): Promise<ReportListResult | null> {
  const supabase = await createClient()
  const page = Math.max(1, parseInt(params.page || '1') || 1)
  const pageSize = 15
  const q = normalizeForSearch(params.q || '')

  const {
    result: { data, error },
  } = await measureQuery('reports.getReportItemsPage', () =>
    supabase.rpc('get_report_items_page', {
      p_q: q || null,
      p_type: params.type || null,
      p_status: params.status || null,
      p_category_id: params.category_id || null,
      p_location_id: params.location_id || null,
      p_sort_by: params.sort_by || 'updated_at',
      p_sort_dir: params.sort_dir === 'asc' ? 'asc' : 'desc',
      p_page: page,
      p_page_size: pageSize,
    })
  )

  if (error || !data) {
    return null
  }

  const payload = data as ReportItemsPageRpcResponse
  if (!Array.isArray(payload.items)) {
    return null
  }
  const totalCount = payload.total_count ?? 0

  return {
    items: (payload.items ?? []).map(toReportItemRow),
    totalCount,
    totalQuantity: payload.total_quantity ?? 0,
    totalValue: payload.total_value ?? 0,
    totalPages: payload.total_pages ?? Math.max(1, Math.ceil(totalCount / pageSize)),
    page: payload.page ?? page,
    auditedCount: payload.audited_count ?? 0,
    overdueAuditItems: (payload.overdue_audit_items ?? []).map(toReportItemRow),
  }
}

export async function getReportItemsList(
  params: ItemListSearchParams,
  noPagination = false
): Promise<ReportListResult> {
  if (!noPagination) {
    const rpcResult = await getReportItemsPageViaRpc(params)
    if (rpcResult) return rpcResult
  }

  const supabase = await createClient()
  const q = normalizeForSearch(params.q || '')

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

  if (params.status === 'archive') {
    query = query.in('status', ['inactive', 'disposed'])
  } else if (params.status) {
    query = query.eq('status', params.status)
  } else {
    // Hide inactive & disposed items from reports by default
    query = query.not('status', 'in', '("inactive","disposed")')
  }

  if (params.category_id) {
    query = query.eq('category_id', params.category_id)
  }

  if (params.location_id) {
    query = query.eq('location_id', params.location_id)
  }

  const {
    result: { data, error },
  } = await measureQuery('reports.getReportItemsList', () =>
    query.order('updated_at', { ascending: false })
  )

  if (error) throw new Error(error.message)
  
  const rawRows = data ?? []
  const allItems = rawRows.map(toReportItemRow)

  // Sort allItems in JS before pagination and aggregation slices
  const sortBy = params.sort_by || 'updated_at'
  const sortDir = params.sort_dir === 'asc' ? 'asc' : 'desc'

  allItems.sort((a, b) => {
    let valA: string | number = ''
    let valB: string | number = ''

    if (sortBy === 'item_name') {
      valA = a.item_name || ''
      valB = b.item_name || ''
    } else if (sortBy === 'category') {
      valA = a.category?.name || ''
      valB = b.category?.name || ''
    } else if (sortBy === 'quantity') {
      valA = a.quantity || 0
      valB = b.quantity || 0
    } else if (sortBy === 'unit_price') {
      valA = getItemValue(a.item_name, a.category?.name)
      valB = getItemValue(b.item_name, b.category?.name)
    } else if (sortBy === 'total_price') {
      valA = getItemValue(a.item_name, a.category?.name) * a.quantity
      valB = getItemValue(b.item_name, b.category?.name) * b.quantity
    } else {
      // Default: updated_at
      valA = new Date(a.updated_at).getTime()
      valB = new Date(b.updated_at).getTime()
    }

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDir === 'asc' 
        ? valA.localeCompare(valB, 'th-TH') 
        : valB.localeCompare(valA, 'th-TH')
    } else {
      return sortDir === 'asc'
        ? (valA > valB ? 1 : valA < valB ? -1 : 0)
        : (valA < valB ? 1 : valA > valB ? -1 : 0)
    }
  })

  // Aggregations over the FULL matching list (un-paginated)
  const totalCount = allItems.length
  const totalQuantity = allItems.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const totalValue = allItems.reduce((sum, item) => sum + (getItemValue(item.item_name, item.category?.name) * item.quantity), 0)

  // Audited count: items updated within past month (simulated as audited)
  const auditedCount = allItems.filter(item => {
    const updated = new Date(item.updated_at)
    const now = new Date()
    const diff = Math.abs(now.getTime() - updated.getTime())
    const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return diffDays <= 30
  }).length

  // Overdue audits: items marked damaged or waiting repair
  const overdueAuditItems = allItems.filter(item => {
    return item.status === 'damaged' || item.status === 'waiting_repair'
  })

  if (noPagination) {
    return {
      items: allItems,
      totalCount,
      totalQuantity,
      totalValue,
      totalPages: 1,
      page: 1,
      auditedCount,
      overdueAuditItems
    }
  }

  // Pagination parameters
  const page = Math.max(1, parseInt(params.page || '1') || 1)
  const pageSize = 15 // Show 15 rows per page on reports ledger
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // Slice for current page
  const slicedItems = allItems.slice((page - 1) * pageSize, page * pageSize)

  return {
    items: slicedItems,
    totalCount,
    totalQuantity,
    totalValue,
    totalPages,
    page,
    auditedCount,
    overdueAuditItems
  }
}


