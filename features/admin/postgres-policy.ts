import { z } from 'zod'
import { assertAdminTable, type AdminTable } from './table-policy'
import { stripBom } from '@/lib/unicode'

export const backupTables = ['profiles', 'categories', 'locations', 'units', 'items', 'audit_logs'] as const
export type BackupTable = typeof backupTables[number]
const timestamps = ['created_at', 'updated_at']
export const tableColumns: Record<BackupTable, readonly string[]> = {
  profiles: ['id', 'full_name', 'email', 'role', 'is_active', 'sidebar_order', ...timestamps],
  categories: ['id', 'name', 'description', 'is_active', ...timestamps],
  locations: ['id', 'name', 'building', 'floor', 'room', 'department', 'description', 'is_active', ...timestamps],
  units: ['id', 'name', 'is_active', ...timestamps],
  items: ['id', 'item_name', 'item_type', 'category_id', 'quantity', 'unit_price', 'unit_id', 'asset_no', 'serial_no', 'brand', 'model', 'location_id', 'responsible_person', 'status', 'note', 'image_url', 'created_by', 'updated_by', 'deleted_by', ...timestamps, 'deleted_at', 'depreciation_enabled', 'depreciation_method', 'depreciation_cost', 'depreciation_useful_life_years', 'depreciation_start_basis', 'depreciation_start_date', 'depreciation_residual_value'],
  audit_logs: ['id', 'user_id', 'action', 'target_table', 'target_id', 'old_data', 'new_data', 'created_at'],
}

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(1).max(255).optional(),
  role: z.enum(['admin', 'staff', 'viewer']).optional(),
  is_active: z.boolean().optional(),
}).strict()
export const newUserSchema = profileUpdateSchema.required().extend({
  email: z.string().trim().email().max(320).optional().or(z.literal('')),
  password: z.string().min(6).max(1024),
})
export const uuidSchema = z.string().uuid()

export function assertSelfProtection(actorId: string, userId: string, payload: { role?: string; is_active?: boolean }, deleting = false) {
  if (actorId !== userId) return
  if (deleting) throw new Error('ไม่สามารถลบบัญชีของตนเองได้')
  if (payload.is_active === false) throw new Error('ไม่สามารถปิดการใช้งานบัญชีของตนเองได้')
  if (payload.role && payload.role !== 'admin') throw new Error('ไม่สามารถเปลี่ยนบทบาทของตนเองได้')
}

export function pageBounds(page = 1, pageSize = 50) {
  const size = Number.isFinite(pageSize) ? Math.min(200, Math.max(1, Math.floor(pageSize))) : 50
  const current = Number.isFinite(page) ? Math.max(1, Math.min(1_000_000, Math.floor(page))) : 1
  return { limit: size, offset: (current - 1) * size }
}

export function writablePayload(tableName: string, payload: Record<string, unknown>): { table: AdminTable; payload: Record<string, unknown> } {
  const table = assertAdminTable(tableName, 'write')
  if (table === 'audit_logs') throw new Error('Audit history is read-only.')
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid row data.')
  const clean: Record<string, unknown> = {}
  const ignored = ['id', 'created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by', 'deleted_by']
  for (const [key, value] of Object.entries(payload)) {
    if (ignored.includes(key)) continue
    if (!tableColumns[table].includes(key)) throw new Error(`Unsupported field: ${key}`)
    if (table === 'profiles' && !['full_name', 'role', 'is_active'].includes(key)) {
      throw new Error('Use user management to change account details.')
    }
    clean[key] = value === '' ? null : value
  }
  if (!Object.keys(clean).length) throw new Error('No editable fields were supplied.')
  return { table, payload: table === 'profiles' ? profileUpdateSchema.parse(clean) : clean }
}

export function parseBusinessBackup(source: string) {
  if (Buffer.byteLength(source, 'utf8') > 25 * 1024 * 1024) throw new Error('Backup file is too large. Maximum size is 25 MB.')
  const backup: unknown = JSON.parse(stripBom(source))
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) throw new Error('Invalid backup file format: expected an object.')
  const value = backup as Record<string, unknown>
  if (!value.__meta || typeof value.__meta !== 'object' || (value.__meta as { version?: unknown }).version !== 1) throw new Error('Unsupported backup format version.')
  for (const key of Object.keys(value)) {
    if (key !== '__meta' && !(backupTables as readonly string[]).includes(key)) throw new Error(`Unsupported backup table: ${key}`)
  }
  const result = {} as Record<BackupTable, Record<string, unknown>[]>
  for (const table of backupTables) {
    const rows = value[table]
    if (!Array.isArray(rows)) throw new Error(`Invalid backup file format: ${table} must be an array.`)
    if (rows.length > 100_000) throw new Error('Backup contains too many rows.')
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Invalid row in ${table}.`)
      for (const key of Object.keys(row)) {
        if (!tableColumns[table].includes(key)) throw new Error(`Unsupported backup field: ${table}.${key}`)
      }
      uuidSchema.parse(row.id)
    }
    result[table] = rows
  }
  return result
}
