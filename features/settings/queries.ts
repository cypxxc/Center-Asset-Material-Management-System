import 'server-only'

import { isPostgresBackend } from '@/lib/backend'
import { getPostgresSettingsData, getPostgresLocationsOverview } from './postgres-queries'

import { createClient } from '@/lib/supabase/server'
import type { SettingsData, SettingsPageData } from './types'

export type SettingsDataSection = 'categories' | 'locations' | 'units' | 'all'

export async function getSettingsData(section: SettingsDataSection = 'all'): Promise<SettingsData> {
  if (isPostgresBackend()) return getPostgresSettingsData(section)
  const supabase = await createClient()
  const queryCategories = () => supabase
    .from('categories')
    .select('id, name, description, is_active, updated_at')
    .order('name')
  const queryLocations = () => supabase
    .from('locations')
    .select('id, name, building, floor, room, department, description, is_active, updated_at')
    .order('name')
  const queryUnits = () => supabase
    .from('units')
    .select('id, name, is_active, updated_at')
    .order('name')

  const emptyData: SettingsData = {
    categories: [],
    locations: [],
    units: [],
  }

  if (section === 'categories') {
    const { data, error } = await queryCategories()
    if (error) throw new Error('Unable to load settings data')
    return { ...emptyData, categories: data ?? [] }
  }

  if (section === 'locations') {
    const { data, error } = await queryLocations()
    if (error) throw new Error('Unable to load settings data')
    return { ...emptyData, locations: data ?? [] }
  }

  if (section === 'units') {
    const { data, error } = await queryUnits()
    if (error) throw new Error('Unable to load settings data')
    return { ...emptyData, units: data ?? [] }
  }

  const [categories, locations, units] = await Promise.all([
    queryCategories(),
    queryLocations(),
    queryUnits(),
  ])

  if (categories.error) throw new Error('Unable to load categories')
  if (locations.error) throw new Error('Unable to load locations')
  if (units.error) throw new Error('Unable to load units')

  return {
    categories: categories.data ?? [],
    locations: locations.data ?? [],
    units: units.data ?? [],
  }
}

interface SupabaseItemLocationRow {
  id: string
  item_name: string
  item_type: string
  quantity: number
  asset_no: string | null
  serial_no: string | null
  status: string
  category: { name: string } | { name: string }[] | null
  location: { id: string; name: string } | { id: string; name: string }[] | null
}

export async function getLocationsOverview() {
  if (isPostgresBackend()) {
    return getPostgresLocationsOverview()
  }

  const supabase = await createClient()
  const [locationsResult, itemsResult] = await Promise.all([
    supabase.from('locations').select('id, name, building, floor, room').eq('is_active', true).order('name'),
    supabase.from('items').select(`
      id,
      item_name,
      item_type,
      quantity,
      asset_no,
      serial_no,
      status,
      category:categories(name),
      location:locations(id, name)
    `).is('deleted_at', null),
  ])

  const { data: locations, error: locError } = locationsResult
  const { data: items, error: itemsError } = itemsResult

  if (locError) throw new Error(locError.message)
  if (itemsError) throw new Error(itemsError.message)

  const mappedItems = ((items as unknown as SupabaseItemLocationRow[]) ?? []).map((item) => {
    const locObj = Array.isArray(item.location) ? item.location[0] : item.location
    const catObj = Array.isArray(item.category) ? item.category[0] : item.category
    return {
      id: item.id,
      name: item.item_name,
      type: item.item_type,
      qty: item.quantity,
      categoryName: catObj?.name || 'ทั่วไป',
      locationId: locObj?.id || null,
      locationName: locObj?.name || 'ไม่มีระบุสถานที่',
      status: item.status,
      serialNumber: item.serial_no || item.asset_no || '-',
    }
  })

  return {
    locations: locations ?? [],
    items: mappedItems,
  }
}

export async function getSettingsPageData(tabParam?: string): Promise<SettingsPageData> {
  const activeTab = ['categories', 'locations', 'units', 'import'].includes(tabParam ?? '')
    ? tabParam!
    : 'categories'

  const metadataSection =
    activeTab === 'categories' || activeTab === 'locations' || activeTab === 'units'
      ? activeTab
      : 'all'

  const data = activeTab === 'import'
    ? { categories: [], locations: [], units: [] }
    : await getSettingsData(metadataSection)

  return {
    activeTab,
    data,
  }
}

