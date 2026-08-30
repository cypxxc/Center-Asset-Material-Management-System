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

