import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { SettingsData, ProfileRow } from './types'

export type SettingsDataSection = 'categories' | 'locations' | 'units' | 'all'

export async function getSettingsData(section: SettingsDataSection = 'all'): Promise<SettingsData> {
  const supabase = await createClient()
  const emptyData: SettingsData = {
    categories: [],
    locations: [],
    units: [],
  }

  if (section === 'categories') {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, description, is_active, updated_at')
      .order('name')
    if (error) throw new Error('Unable to load settings data')
    return { ...emptyData, categories: data ?? [] }
  }

  if (section === 'locations') {
    const { data, error } = await supabase
      .from('locations')
      .select('id, name, building, floor, room, department, description, is_active, updated_at')
      .order('name')
    if (error) throw new Error('Unable to load settings data')
    return { ...emptyData, locations: data ?? [] }
  }

  if (section === 'units') {
    const { data, error } = await supabase
      .from('units')
      .select('id, name, is_active, updated_at')
      .order('name')
    if (error) throw new Error('Unable to load settings data')
    return { ...emptyData, units: data ?? [] }
  }

  const [categories, locations, units] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, description, is_active, updated_at')
      .order('name'),
    supabase
      .from('locations')
      .select('id, name, building, floor, room, department, description, is_active, updated_at')
      .order('name'),
    supabase
      .from('units')
      .select('id, name, is_active, updated_at')
      .order('name'),
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

export async function getAllProfiles(): Promise<ProfileRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error('Unable to load settings data')
  return data ?? []
}
