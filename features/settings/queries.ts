import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { SettingsData, ProfileRow } from './types'


export async function getSettingsData(): Promise<SettingsData> {
  const supabase = await createClient()

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

  if (categories.error) throw new Error(categories.error.message)
  if (locations.error) throw new Error(locations.error.message)
  if (units.error) throw new Error(units.error.message)

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

  if (error) throw new Error(error.message)
  return data ?? []
}
