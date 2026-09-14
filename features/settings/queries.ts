import 'server-only'

import { isPostgresBackend } from '@/lib/backend'
import { getPostgresSettingsData } from './postgres-queries'

import { createClient } from '@/lib/supabase/server'
import type { SettingsData } from './types'

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
