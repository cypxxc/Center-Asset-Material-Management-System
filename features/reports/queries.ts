import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ItemListSearchParams, ItemListRow } from '@/features/items/types'
import { normalizeForSearch } from '@/lib/unicode'
import { measureQuery } from '@/lib/performance'
import { EXPORT_BATCH_SIZE, PDF_EXPORT_LIMIT, walkReportBatches, type ExportBatch } from './export-batches'

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

/**
 * Fetches summary statistics for reports dashboard.
 * Uses the optimized `get_report_stats` RPC to perform aggregations server-side in a single query
 * with efficient column projection, bypassing client payload overhead.
 */
export const getReportStats = cache(async function getReportStats(): Promise<ReportStats> {
  const supabase = await createClient()
  const {
    result: { data, error },
  } = await measureQuery('reports.getReportStats', () => supabase.rpc('get_report_stats'))

  if (error || !data) {
    if (error) throw new Error('Unable to load report data')
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
})

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export interface ReportItemRow extends ItemListRow {
  brand: string | null
  model: string | null
  unit_price: number | null
}

export interface ReportListResult {
  items: ReportItemRow[]
  totalCount: number
  totalQuantity: number
  totalValue: number
  totalPages: number
  page: number
}

interface ReportItemsPageRpcResponse {
  items?: unknown[]
  total_count?: number
  total_quantity?: number
  total_value?: number
  total_pages?: number
  page?: number
}

function toReportItemRow(row: unknown): ReportItemRow {
  const r = row as {
    id: string
    item_name: string
    item_type: string
    quantity: number
    unit_price: number | null
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
    unit_price: r.unit_price ?? null,
    category: firstRelation(r.category as Record<string, unknown> | Record<string, unknown>[] | null),
    unit: firstRelation(r.unit as Record<string, unknown> | Record<string, unknown>[] | null),
    location: firstRelation(r.location as Record<string, unknown> | Record<string, unknown>[] | null),
  } as unknown as ReportItemRow
}

function reportRpcParams(params: ItemListSearchParams) {
  return {
    p_q: normalizeForSearch(params.q || '') || null,
    p_type: params.type || null, p_status: params.status || null,
    p_category_id: params.category_id || null, p_location_id: params.location_id || null,
    p_sort_by: params.sort_by || 'updated_at', p_sort_dir: params.sort_dir === 'asc' ? 'asc' : 'desc',
  }
}

async function getReportItemsPageViaRpc(params: ItemListSearchParams, pageSize = 15, signal?: AbortSignal): Promise<ReportListResult> {
  const supabase = await createClient()
  const page = Math.max(1, parseInt(params.page || '1') || 1)
  const { result: { data, error } } = await measureQuery('reports.getReportItemsPage', () => {
    const query = supabase.rpc('get_report_items_page', { ...reportRpcParams(params), p_page: page, p_page_size: pageSize })
    return query.abortSignal(signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000))
  })
  if (error || !data) throw new Error('ไม่สามารถโหลดรายงานได้ กรุณาลองใหม่ภายหลัง')
  const payload = data as ReportItemsPageRpcResponse
  if (!Array.isArray(payload.items) || payload.items.length > pageSize || !Number.isSafeInteger(payload.total_count) || payload.total_count! < 0 || !Number.isFinite(payload.total_quantity) || !Number.isFinite(payload.total_value)) {
    throw new Error('Invalid report response')
  }
  return {
    items: payload.items.map(toReportItemRow), totalCount: payload.total_count!,
    totalQuantity: payload.total_quantity!, totalValue: payload.total_value!,
    totalPages: Math.max(1, Math.ceil(payload.total_count! / pageSize)), page,
  }
}

export async function getReportItemsList(params: ItemListSearchParams, noPagination = false): Promise<ReportListResult> {
  // Legacy consumers are bounded too; Excel downloads use the streaming route.
  if (noPagination) return { ...await getExportReportItems(params), page: 1, totalPages: 1 }
  return getReportItemsPageViaRpc(params)
}

export async function prepareReportExport(params: ItemListSearchParams, signal?: AbortSignal) {
  const summary = await getReportItemsPageViaRpc({ ...params, page: '1' }, 1, signal)
  const supabase = await createClient()
  const batches = walkReportBatches<ReportItemRow>(async cursor => {
    const { result: { data, error } } = await measureQuery('reports.getExportBatch', () =>
      supabase.rpc('get_report_export_batch', {
        ...reportRpcParams(params), p_after: cursor, p_batch_size: EXPORT_BATCH_SIZE,
      }).abortSignal(signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000)))
    if (error || !data) throw new Error('ไม่สามารถอ่านข้อมูลส่งออกได้ กรุณาลองใหม่')
    const batch = data as ExportBatch<ReportItemRow>
    if (!Array.isArray(batch.items)) throw new Error('Invalid export batch')
    return { items: batch.items.map(toReportItemRow), next_cursor: batch.next_cursor }
  }, summary.totalCount, signal)
  return { totalCount: summary.totalCount, batches }
}

/** Only the bounded browser PDF path may materialize rows. */
export async function getExportReportItems(params: ItemListSearchParams): Promise<{
  items: ReportItemRow[]; totalCount: number; totalQuantity: number; totalValue: number
}> {
  const { totalCount, batches } = await prepareReportExport(params)
  if (totalCount > PDF_EXPORT_LIMIT) throw new Error('PDF รองรับไม่เกิน 5,000 รายการ กรุณาลดตัวกรองหรือส่งออก Excel')
  const items: ReportItemRow[] = []
  let totalQuantity = 0
  let totalValue = 0
  for await (const batch of batches) {
    for (const item of batch) {
      items.push(item)
      totalQuantity += item.quantity
      totalValue += item.quantity * (item.unit_price ?? 0)
    }
  }
  return { items, totalCount, totalQuantity, totalValue }
}
