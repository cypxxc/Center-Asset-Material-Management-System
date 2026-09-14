import { sql } from 'drizzle-orm'
import { pgTable, pgSchema, uuid, text, boolean, timestamp, integer, numeric, date, jsonb, index, uniqueIndex, check } from 'drizzle-orm/pg-core'

const stamps = () => ({ created_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow(), updated_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow() })
export const profiles = pgTable('profiles', {
  id: uuid().primaryKey().defaultRandom(), full_name: text().notNull(), email: text().notNull(),
  role: text().notNull().default('viewer'), is_active: boolean().notNull().default(true),
  sidebar_order: jsonb().$type<string[]>().default([]), ...stamps(),
}, (t) => [uniqueIndex('profiles_email_unique').on(sql`lower(${t.email})`), check('profiles_role_check', sql`${t.role} in ('admin','staff','viewer')`)])
export const categories = pgTable('categories', {
  id: uuid().primaryKey().defaultRandom(), name: text().notNull().unique(), description: text(), is_active: boolean().notNull().default(true), ...stamps(),
})
export const locations = pgTable('locations', {
  id: uuid().primaryKey().defaultRandom(), name: text().notNull(), building: text(), floor: text(), room: text(), department: text(), description: text(), is_active: boolean().notNull().default(true), ...stamps(),
})
export const units = pgTable('units', {
  id: uuid().primaryKey().defaultRandom(), name: text().notNull().unique(), is_active: boolean().notNull().default(true), ...stamps(),
})
export const items = pgTable('items', {
  id: uuid().primaryKey().defaultRandom(), item_name: text().notNull(), item_type: text().notNull(),
  category_id: uuid().references(() => categories.id), location_id: uuid().references(() => locations.id), unit_id: uuid().references(() => units.id),
  quantity: integer().notNull().default(1), unit_price: numeric({ precision: 12, scale: 2, mode: 'number' }),
  asset_no: text(), serial_no: text(), brand: text(), model: text(), responsible_person: text(), status: text().notNull().default('active'), note: text(), image_url: text(),
  created_by: uuid().references(() => profiles.id, { onDelete: 'set null' }), updated_by: uuid().references(() => profiles.id, { onDelete: 'set null' }), deleted_by: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  deleted_at: timestamp({ withTimezone: true, mode: 'string' }),
  depreciation_enabled: boolean().notNull().default(false), depreciation_method: text(), depreciation_cost: numeric({ precision: 12, scale: 2, mode: 'number' }), depreciation_useful_life_years: integer(), depreciation_start_basis: text(), depreciation_start_date: date({ mode: 'string' }), depreciation_residual_value: numeric({ precision: 12, scale: 2, mode: 'number' }).notNull().default(1), ...stamps(),
}, (t) => [
  check('items_type_check', sql`${t.item_type} in ('asset','material')`),
  check('items_status_check', sql`${t.status} in ('active','spare','damaged','waiting_repair','inactive','disposed')`),
  check('items_quantity_check', sql`${t.quantity} >= 0`), check('items_price_check', sql`${t.unit_price} is null or ${t.unit_price} >= 0`),
  check('items_depreciation_check', sql`not ${t.depreciation_enabled} or coalesce((${t.item_type}='asset' and ${t.depreciation_method}='straight_line' and ${t.depreciation_cost}>1 and ${t.depreciation_useful_life_years}>0 and ${t.depreciation_start_basis} in ('acquired','available','manual') and ${t.depreciation_start_date} is not null and ${t.depreciation_residual_value}=1),false)`),
  uniqueIndex('items_asset_no_unique').on(t.asset_no).where(sql`${t.deleted_at} is null and ${t.asset_no} is not null`),
  uniqueIndex('items_serial_no_unique').on(t.serial_no).where(sql`${t.deleted_at} is null and ${t.serial_no} is not null`),
  index('items_updated_index').on(t.updated_at), index('items_category_index').on(t.category_id), index('items_location_index').on(t.location_id), index('items_type_status_index').on(t.item_type, t.status),
])
export const auditLogs = pgTable('audit_logs', {
  id: uuid().primaryKey().defaultRandom(), user_id: uuid().references(() => profiles.id, { onDelete: 'set null' }), action: text().notNull(), target_table: text().notNull(), target_id: uuid(), old_data: jsonb(), new_data: jsonb(), created_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => [index('audit_created_index').on(t.created_at), index('audit_target_index').on(t.target_table, t.target_id)])
const auth = pgSchema('private_auth')
export const credentials = auth.table('credentials', { user_id: uuid().primaryKey().references(() => profiles.id, { onDelete: 'cascade' }), password_hash: text().notNull() })
export const sessions = auth.table('sessions', { token_hash: text().primaryKey(), user_id: uuid().notNull().references(() => profiles.id, { onDelete: 'cascade' }), expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(), created_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow() }, (t) => [index('sessions_user_index').on(t.user_id), index('sessions_expiry_index').on(t.expires_at)])
export const loginAttempts = auth.table('login_attempts', { key: text().primaryKey(), window_started_at: timestamp({ withTimezone:true,mode:'string' }).notNull().defaultNow(), attempts: integer().notNull() }, t=>[index('login_attempts_window_index').on(t.window_started_at)])
