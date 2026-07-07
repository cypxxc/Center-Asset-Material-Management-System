export type ItemType = 'material' | 'asset'

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
}

export interface ItemListRow {
  id: string
  item_name: string
  item_type: ItemType
  quantity: number
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
  image_url?: string | null
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
  status?: string
  page?: string
  category_id?: string
  location_id?: string
  sort_by?: string
  sort_dir?: string
}

export interface ItemListResult {
  items: ItemListRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  material: 'วัสดุสิ้นเปลือง',
  asset: 'ครุภัณฑ์',
}

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  active: 'ใช้งานอยู่',
  spare: 'สำรอง',
  damaged: 'ชำรุด',
  waiting_repair: 'รอซ่อม',
  inactive: 'ไม่ใช้งาน',
  disposed: 'จำหน่ายแล้ว',
}
