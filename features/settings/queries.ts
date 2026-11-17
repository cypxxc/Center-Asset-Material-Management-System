import 'server-only'
import { cache } from 'react'
import { getPostgresSettingsData, getPostgresLocationsOverview } from './postgres-queries'
import type { LocationsOverview, SettingsData, SettingsPageData } from './types'

export type SettingsDataSection = 'categories' | 'locations' | 'units' | 'all'

export const getSettingsData = cache(async (section: SettingsDataSection = 'all'): Promise<SettingsData> =>
  getPostgresSettingsData(section))

export const getLocationsOverview = cache(async (): Promise<LocationsOverview> =>
  getPostgresLocationsOverview())

export async function getSettingsPageData(tabParam?: string): Promise<SettingsPageData> {
  const activeTab = ['categories', 'material-categories', 'locations', 'units', 'import'].includes(tabParam ?? '') ? tabParam! : 'categories'
  const metadataSection = activeTab === 'categories' || activeTab === 'locations' || activeTab === 'units' ? activeTab : 'all'
  const data = activeTab === 'import' ? { categories: [], locations: [], units: [] } : await getSettingsData(activeTab === 'material-categories' ? 'categories' : metadataSection)
  return { activeTab, data }
}
