import 'server-only'
import { cache } from 'react'
import { getPostgresItemReferences, getPostgresItems, getPostgresItemBatch, getPostgresItemById, getPostgresSidebarData, getPostgresItemAuditLogs, getPostgresLowStockItems, getPostgresUrgentDamagedItems } from './postgres-queries'
import type { ItemAuditLog, ItemDetail, ItemListResult, ItemBatchResult, ItemListSearchParams, ReferenceOption, ItemDetailPageData, ItemEditPageData, ItemsExplorerPageData, DashboardLayoutData, UrgentDamagedItem } from './types'
import { ITEMS_PAGE_SIZE, normalizeItemListSearchParams } from './list-params'
import { decodeItemCursor } from './cursor'

export type { UrgentDamagedItem } from './types'
const PAGE_SIZE = 10

export const getItemReferences = cache(async (): Promise<{ categories: ReferenceOption[]; locations: ReferenceOption[]; units: ReferenceOption[] }> => getPostgresItemReferences())
export async function getItems(params: ItemListSearchParams, pageSize = PAGE_SIZE): Promise<ItemListResult> { return getPostgresItems(params, pageSize) }
export async function getItemBatch(params: ItemListSearchParams, cursor?: string): Promise<ItemBatchResult> {
  const normalized = normalizeItemListSearchParams(params)
  return getPostgresItemBatch(normalized, cursor ? decodeItemCursor(cursor, normalized) : null)
}
export async function getItemById(id: string): Promise<ItemDetail | null> { return getPostgresItemById(id) }
export async function getItemAuditLogs(itemId: string): Promise<ItemAuditLog[]> { return getPostgresItemAuditLogs(itemId) }

export async function getItemDetailPageData(id: string): Promise<ItemDetailPageData> {
  const [item, auditLogs] = await Promise.all([getItemById(id), getItemAuditLogs(id)])
  return { item, auditLogs }
}

export async function getItemEditPageData(id: string): Promise<ItemEditPageData> {
  const [item, references] = await Promise.all([getItemById(id), getItemReferences()])
  return { item, references }
}

export async function getItemsExplorerPageData(params: ItemListSearchParams): Promise<ItemsExplorerPageData> {
  const [references, result] = await Promise.all([getItemReferences(), getItems(params, ITEMS_PAGE_SIZE)])
  return { ...result, references }
}

const getSidebarData = cache(async () => getPostgresSidebarData())
export const getDashboardLayoutData = cache(async (): Promise<DashboardLayoutData> => {
  const [sidebarData, references] = await Promise.all([getSidebarData(), getItemReferences()])
  return { sidebarData, references }
})

export interface LowStockDashboardItem { id: string; item_name: string; quantity: number; locationName: string }
export const getLowStockItems = cache(async (limit = 5): Promise<LowStockDashboardItem[]> => getPostgresLowStockItems(limit))
export const getUrgentDamagedItems = cache(async (limit = 5): Promise<UrgentDamagedItem[]> => getPostgresUrgentDamagedItems(limit))
