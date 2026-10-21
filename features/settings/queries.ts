import 'server-only'

import { isPostgresBackend } from '@/lib/backend'
import { getPostgresSettingsData, getPostgresLocationsOverview } from './postgres-queries'

import { createClient } from '@/lib/supabase/server'
import { getItemReferences } from '@/features/items/queries'
import type { LocationsOverview, SettingsData, SettingsPageData } from './types'

export type SettingsDataSection = 'categories' | 'locations' | 'units' | 'all'

export async function getSettingsData(section: SettingsDataSection = 'all'): Promise<SettingsData> {
  if (isPostgresBackend()) return getPostgresSettingsData(section)
  const supabase = await createClient()
  const queryCategories = () => supabase
    .from('categories')
    .select('id, name, description, color, icon, is_active, updated_at')
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

export async function getLocationsOverview(): Promise<LocationsOverview> {
  if (isPostgresBackend()) {
    return getPostgresLocationsOverview()
  }

  const supabase = await createClient()
  const [locationsResult, itemsResult, references] = await Promise.all([
    supabase.from('locations').select('id, name, building, floor, room').eq('is_active', true).order('name'),
    supabase.from('items').select(`
      id,
      item_name,
      item_type,
      quantity,
      asset_no,
      serial_no,
      status,
      category_id,
      location_id
    `).is('deleted_at', null),
    getItemReferences(),
  ])

  const { data: locations, error: locError } = locationsResult
  const { data: items, error: itemsError } = itemsResult

  if (locError) throw new Error(locError.message)
  if (itemsError) throw new Error(itemsError.message)

  const categoryMap = new Map<string, string>()
  references.categories.forEach((c) => categoryMap.set(c.id, c.name))

  const locationMap = new Map<string, string>()
  references.locations.forEach((l) => locationMap.set(l.id, l.name))

  interface SupabaseItemFkRow {
    id: string
    item_name: string
    item_type: string
    quantity: number
    asset_no: string | null
    serial_no: string | null
    status: string
    category_id: string | null
    location_id: string | null
  }

  const mappedItems = ((items as unknown as SupabaseItemFkRow[]) ?? []).map((item) => {
    const categoryName = item.category_id ? categoryMap.get(item.category_id) || 'ทั่วไป' : 'ทั่วไป'
    const locationName = item.location_id ? locationMap.get(item.location_id) || 'ไม่มีระบุสถานที่' : 'ไม่มีระบุสถานที่'
    return {
      id: item.id,
      name: item.item_name,
      type: item.item_type,
      qty: item.quantity,
      categoryName,
      locationId: item.location_id,
      locationName,
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

