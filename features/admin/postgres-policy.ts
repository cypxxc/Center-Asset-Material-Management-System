import { z } from 'zod'
import { assertAdminTable, type AdminTable } from './table-policy'
import { stripBom } from '@/lib/unicode'
import { MATERIAL_LEDGER_FIELDS } from '@/features/items/material-fields'
import { randomUUID } from 'node:crypto'

export const backupTables = ['profiles', 'categories', 'locations', 'units', 'items', 'materials', 'audit_logs'] as const
export type BackupTable = typeof backupTables[number]
const timestamps = ['created_at', 'updated_at']
const commonInventoryColumns = [
  'id', 'item_name', 'item_type', 'qualification_status', 'category_id', 'quantity', 'unit_price', 'unit_id',
  'asset_no', 'serial_no', 'brand', 'model', 'location_id', 'responsible_person', 'status', 'note',
  'is_central', 'image_url', 'budget_source', 'gfmis_number', 'acquired_date',
  'created_by', 'updated_by', 'deleted_by', ...timestamps, 'deleted_at',
  'depreciation_enabled', 'depreciation_method', 'depreciation_cost', 'depreciation_useful_life_years',
  'depreciation_start_basis', 'depreciation_start_date', 'depreciation_residual_value',
] as const
const itemRegisterColumns = [
  'register_sequence', 'asset_prefix',
  'register_accumulated_depreciation', 'register_book_value', 'register_as_of',
] as const
const materialVersionColumns = ['metadata_version', 'stock_version'] as const

export const tableColumns: Record<BackupTable, readonly string[]> = {
  profiles: ['id', 'full_name', 'display_name', 'email', 'role', 'is_active', 'sidebar_order', ...timestamps],
  categories: ['id', 'name', 'item_type', 'description', 'color', 'icon', 'is_active', ...timestamps],
  locations: ['id', 'name', 'building', 'floor', 'room', 'department', 'description', 'is_active', ...timestamps],
  units: ['id', 'name', 'is_active', ...timestamps],
  items: [...commonInventoryColumns, ...itemRegisterColumns],
  audit_logs: ['id', 'user_id', 'action', 'target_table', 'target_id', 'old_data', 'new_data', 'created_at'],
  materials: [...commonInventoryColumns, ...materialVersionColumns, ...MATERIAL_LEDGER_FIELDS],
}

export const searchColumns: Record<AdminTable, readonly string[]> = {
  profiles: ['full_name', 'email', 'display_name'],
  categories: ['name', 'description'],
  locations: ['name', 'building', 'room', 'department'],
  units: ['name'],
  items: ['item_name', 'asset_no', 'serial_no', 'brand', 'model', 'responsible_person', 'gfmis_number', 'budget_source'],
  materials: ['item_name', 'specification', 'commodity_code'],
  audit_logs: ['action', 'target_table', 'target_id'],
}

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(1).max(255).optional(),
  display_name: z.string().trim().max(255).nullable().optional(),
  role: z.string().refine((role) => role === 'admin' || role === 'user').optional(),
  is_active: z.boolean().optional(),
}).strict()
export const newUserSchema = z.object({
  full_name: z.string().trim().min(1).max(255),
  display_name: z.string().trim().max(255).nullable().optional(),
  role: z.string().refine((role) => role === 'admin' || role === 'user'),
  is_active: z.boolean(),
  email: z.string().trim().email().max(320).nullish().or(z.literal('')),
  password: z.string().min(6).max(1024),
}).strict()
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
    if (table === 'profiles' && !['full_name', 'display_name', 'role', 'is_active'].includes(key)) {
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
    const rows = table === 'materials' && value[table] === undefined ? [] : value[table]
    if (!Array.isArray(rows)) throw new Error(`Invalid backup file format: ${table} must be an array.`)
    if (rows.length > 100_000) throw new Error('Backup contains too many rows.')
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Invalid row in ${table}.`)
      for (const key of Object.keys(row)) {
        if (!tableColumns[table].includes(key)) throw new Error(`Unsupported backup field: ${table}.${key}`)
      }
      uuidSchema.parse(row.id)
      // Backups made before the role rename retain the same least-privileged access.
      if (table === 'profiles' && row.role === 'viewer') row.role = 'user'
    }
    result[table] = rows
  }
  result.materials.push(...result.items.filter(row => row.item_type === 'material'))
  result.items = result.items.filter(row => row.item_type !== 'material')
  // Older exports shared category IDs. Normalize in memory before the atomic restore.
  // Never reinterpret modern typed categories: inconsistent modern backups must fail their FK.
  const materialCategories = new Set(result.materials.map(row => row.category_id))
  const assetCategories = new Set(result.items.map(row => row.category_id))
  for (const category of [...result.categories]) {
    if (category.item_type !== undefined) {
      z.enum(['asset', 'material']).parse(category.item_type)
      continue
    }
    category.item_type = materialCategories.has(category.id) && !assetCategories.has(category.id) ? 'material' : 'asset'
    if (materialCategories.has(category.id) && assetCategories.has(category.id)) {
      const clone = { ...category, id: randomUUID(), item_type: 'material' }
      result.categories.push(clone)
      for (const material of result.materials) if (material.category_id === category.id) material.category_id = clone.id
    }
  }
  return result
}
