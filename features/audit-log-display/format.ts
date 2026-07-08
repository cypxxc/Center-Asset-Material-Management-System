export interface AuditDiffEntry {
  key: string
  label: string
  oldValue: string
  newValue: string
}

const ACTION_LABELS: Record<string, string> = {
  create: 'สร้างข้อมูล',
  update: 'แก้ไขข้อมูล',
  delete: 'ลบข้อมูล',
  restore: 'กู้คืนข้อมูล',
  hard_delete: 'ลบถาวร',
  bulk_delete: 'ลบหลายรายการ',
  sql_query: 'เรียกใช้ SQL',
  backup_restore: 'กู้คืนฐานข้อมูล',
  create_user: 'สร้างผู้ใช้',
  update_user: 'แก้ไขผู้ใช้',
  delete_user: 'ลบผู้ใช้',
  reset_password: 'รีเซ็ตรหัสผ่าน',
}

const TABLE_LABELS: Record<string, string> = {
  items: 'รายการพัสดุ',
  profiles: 'บัญชีผู้ใช้',
  categories: 'หมวดหมู่',
  locations: 'สถานที่',
  units: 'หน่วยนับ',
  audit_logs: 'ประวัติการทำรายการ',
}

const FIELD_LABELS: Record<string, string> = {
  id: 'รหัสแถว',
  user_id: 'ผู้ใช้ที่ทำรายการ',
  action: 'ประเภทการทำรายการ',
  target_table: 'ตารางเป้าหมาย',
  target_id: 'รหัสแถวเป้าหมาย',
  old_data: 'ข้อมูลเดิม',
  new_data: 'ข้อมูลใหม่',
  created_at: 'วันที่สร้าง',
  updated_at: 'วันที่อัปเดต',
  deleted_at: 'วันที่ลบ',
  item_name: 'ชื่อพัสดุครุภัณฑ์',
  item_type: 'ประเภทสิ่งของ',
  category_id: 'หมวดหมู่',
  unit_id: 'หน่วยนับ',
  location_id: 'สถานที่',
  asset_no: 'เลขครุภัณฑ์',
  serial_no: 'Serial Number',
  brand: 'ยี่ห้อ/แบรนด์',
  model: 'รุ่นสินค้า',
  quantity: 'จำนวน',
  unit_price: 'ราคาต่อหน่วย',
  status: 'สถานะพัสดุ',
  responsible_person: 'ผู้รับผิดชอบ',
  note: 'หมายเหตุ',
  image_url: 'รูปภาพ',
  full_name: 'ชื่อ-นามสกุล',
  email: 'บัญชี / อีเมล',
  role: 'บทบาท',
  is_active: 'สถานะเปิดใช้งาน',
  name: 'ชื่อ',
  description: 'คำอธิบาย',
  building: 'อาคาร',
  floor: 'ชั้น',
  room: 'ห้อง',
  department: 'แผนก/หน่วยงาน',
  query: 'คำสั่ง SQL',
  tables_restored: 'ตารางที่กู้คืน',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'ใช้งานอยู่',
  spare: 'สำรอง',
  damaged: 'ชำรุด',
  waiting_repair: 'รอซ่อม',
  inactive: 'ไม่ใช้งาน',
  disposed: 'จำหน่ายแล้ว',
}

const TYPE_LABELS: Record<string, string> = {
  asset: 'ครุภัณฑ์',
  material: 'วัสดุสิ้นเปลือง',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  staff: 'เจ้าหน้าที่',
  viewer: 'ผู้เข้าชม',
}

const IGNORED_DIFF_KEYS = new Set(['updated_at'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stableValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (isRecord(value) || Array.isArray(value)) return JSON.stringify(value)
  return String(value)
}

export function getAuditActionLabel(action: string | null | undefined): string {
  if (!action) return 'ไม่ระบุ'
  return ACTION_LABELS[action] ?? action
}

export function getAuditTableLabel(tableName: string | null | undefined): string {
  if (!tableName) return 'ไม่ระบุ'
  return TABLE_LABELS[tableName] ?? tableName
}

export function getAuditFieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] ?? fieldName
}

export function formatAuditValue(fieldName: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'ไม่มีข้อมูล'
  if (typeof value === 'boolean') return value ? 'เปิดใช้งาน' : 'ปิดใช้งาน'
  if (fieldName === 'status' && typeof value === 'string') return STATUS_LABELS[value] ?? value
  if (fieldName === 'item_type' && typeof value === 'string') return TYPE_LABELS[value] ?? value
  if (fieldName === 'role' && typeof value === 'string') return ROLE_LABELS[value] ?? value
  if (Array.isArray(value)) return value.map((item) => formatAuditValue(fieldName, item)).join(', ')
  if (isRecord(value)) {
    const json = JSON.stringify(value).replaceAll('":"', '": "').replaceAll('","', '", "')
    return json.length > 2 ? `{ ${json.slice(1, -1)} }` : json
  }
  return String(value)
}

export function buildAuditDiff(
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown> | null | undefined,
): AuditDiffEntry[] {
  const oldRecord = isRecord(oldData) ? oldData : {}
  const newRecord = isRecord(newData) ? newData : {}
  const keys = Array.from(new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]))

  return keys
    .filter((key) => !IGNORED_DIFF_KEYS.has(key))
    .filter((key) => stableValue(oldRecord[key]) !== stableValue(newRecord[key]))
    .map((key) => ({
      key,
      label: getAuditFieldLabel(key),
      oldValue: formatAuditValue(key, oldRecord[key]),
      newValue: formatAuditValue(key, newRecord[key]),
    }))
}

export function summarizeAuditPayload(
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown> | null | undefined,
): string {
  const count = buildAuditDiff(oldData, newData).length
  return count > 0 ? `เปลี่ยนแปลง ${count} ฟิลด์` : 'ดูรายละเอียด JSON'
}

export function formatJsonForDisplay(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2)
}
