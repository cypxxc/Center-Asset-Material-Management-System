export interface CategoryRow {
  id: string
  name: string
  description: string | null
  is_active: boolean
  updated_at: string
}

export interface LocationRow {
  id: string
  name: string
  building: string | null
  floor: string | null
  room: string | null
  department: string | null
  description: string | null
  is_active: boolean
  updated_at: string
}

export interface UnitRow {
  id: string
  name: string
  is_active: boolean
  updated_at: string
}

export interface SettingsData {
  categories: CategoryRow[]
  locations: LocationRow[]
  units: UnitRow[]
}
export interface LocationOverviewItem {
  id: string
  name: string
  type: string
  qty: number
  categoryName: string
  locationId: string | null
  locationName: string
  status: string
  serialNumber: string
}

export interface LocationOverviewRow {
  id: string
  name: string
  building: string | null
  floor: string | null
  room: string | null
}

export interface LocationsOverview {
  locations: LocationOverviewRow[]
  items: LocationOverviewItem[]
}
