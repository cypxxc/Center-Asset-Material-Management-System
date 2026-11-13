export type ItemType = 'material' | 'asset'
export type ItemQualificationStatus = 'qualified' | 'below_threshold'
export type ItemQualificationFilter = ItemQualificationStatus | 'unclassified'

export type ItemStatus =
  | 'active'
  | 'spare'
  | 'damaged'
  | 'waiting_repair'
  | 'inactive'
  | 'disposed'

export interface ReferenceOption {
  id: string
  name: string
  color?: string
  icon?: string | null
}

export interface ItemListRow {
  id: string
  item_name: string
  item_type: ItemType
  qualification_status?: ItemQualificationStatus | null
  quantity: number
  unit_price: number | null
  asset_no: string | null
  serial_no: string | null
  responsible_person: string | null
  status: ItemStatus
  updated_at: string
  category: ReferenceOption | null
  unit: ReferenceOption | null
  location: ReferenceOption | null
  brand?: string | null
  model?: string | null
  note?: string | null
  is_central?: boolean
  is_borrowed?: boolean
  image_url?: string | null
  gfmis_number?: string | null
  budget_source?: string | null
  acquired_date?: string | null
  depreciation_enabled?: boolean
  depreciation_method?: 'straight_line' | null
  depreciation_cost?: number | null
  depreciation_useful_life_years?: number | null
  depreciation_start_basis?: 'acquired' | 'available' | 'manual' | null
  depreciation_start_date?: string | null
  depreciation_residual_value?: number | null
}


export interface ItemDetail extends ItemListRow {
  brand: string | null
  model: string | null
  note: string | null
  image_url: string | null
  created_at: string
}

export interface ItemListSearchParams {
  q?: string
  type?: string
  qualification?: ItemQualificationFilter | string
  status?: string
  is_central?: string
  page?: string
  category_id?: string
  location_id?: string
  sort_by?: string
  sort_dir?: string
}

export interface ItemListResult {
  items: ItemListRow[]
  total: number
  classificationCounts: ItemClassificationCounts
  page: number
  pageSize: number
  totalPages: number
}

export interface ItemClassificationCounts {
  all: number
  assets: number
  materials: number
  qualified: number
  belowThreshold: number
  unclassified: number
}

export interface ItemAuditLog {
  id: string
  action: string
  created_at: string
  user_name: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}

export interface ItemBatchResult {
  items: ItemListRow[]
  total: number | null
  nextCursor: string | null
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  material: 'พัสดุ',
  asset: 'ครุภัณฑ์',
}

export const ITEM_QUALIFICATION_LABELS: Record<ItemQualificationStatus, string> = {
  qualified: 'ครุภัณฑ์ตามเกณฑ์',
  below_threshold: 'ครุภัณฑ์ต่ำกว่าเกณฑ์ (ต.)',
}

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  active: 'ใช้งานได้',
  spare: 'ใช้งานได้',
  damaged: 'ชำรุด',
  waiting_repair: 'ชำรุด',
  inactive: 'เสื่อมสภาพ',
  disposed: 'เสื่อมสภาพ',
}

export interface ItemEditPageData {
  item: ItemDetail | null
  references: {
    categories: ReferenceOption[]
    locations: ReferenceOption[]
    units: ReferenceOption[]
    responsibleUsers?: ReferenceOption[]
  }
}

export interface ItemsExplorerPageData {
  items: ItemListRow[]
  total: number
  classificationCounts: ItemClassificationCounts
  page: number
  pageSize: number
  totalPages: number
  nextCursor?: string | null
  references: {
    categories: ReferenceOption[]
    locations: ReferenceOption[]
    units: ReferenceOption[]
    responsibleUsers?: ReferenceOption[]
  }
}

export interface DashboardLayoutData {
  sidebarData: {
    categories: { id: string; name: string; icon?: string | null; count: number }[]
    locations: { id: string; name: string; count: number }[]
    counts: {
      total_assets: number
      total_supplies: number
      archive_count: number
      trash_count: number
    }
  }
  references: {
    categories: ReferenceOption[]
    locations: ReferenceOption[]
    units: ReferenceOption[]
    responsibleUsers?: ReferenceOption[]
  }
}

export interface UrgentDamagedItem {
  id: string
  item_name: string
  asset_no: string | null
  locationName: string
  status: string
  updated_at: string
  image_url: string | null
}
