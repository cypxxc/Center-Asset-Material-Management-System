import { sql } from 'drizzle-orm'
import { pgTable, pgSchema, uuid, text, boolean, timestamp, integer, numeric, date, jsonb, index, uniqueIndex, check } from 'drizzle-orm/pg-core'

const stamps = () => ({ created_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow(), updated_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow() })
export const profiles = pgTable('profiles', {
  id: uuid().primaryKey().defaultRandom(), full_name: text().notNull(), email: text().notNull(),
  role: text().notNull().default('viewer'), is_active: boolean().notNull().default(true),
  sidebar_order: jsonb().$type<string[]>().default([]), ...stamps(),
}, (t) => [uniqueIndex('profiles_email_unique').on(sql`lower(${t.email})`), check('profiles_role_check', sql`${t.role} in ('admin','staff','viewer')`)])
export const categories = pgTable('categories', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  description: text(),
  color: text().notNull().default('#64748B'),
  icon: text().notNull().default('Tag'),
  is_active: boolean().notNull().default(true),
  ...stamps(),
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

export const disbursementSequences = pgTable('disbursement_sequences', {
  fiscal_year: integer().notNull(),
  prefix: text().notNull(),
  current_val: integer().notNull().default(0),
}, (t) => [uniqueIndex('disbursement_sequences_pk').on(t.fiscal_year, t.prefix)])

export const disbursements = pgTable('disbursements', {
  id: uuid().primaryKey().defaultRandom(),
  document_no: text().unique(),
  fiscal_year: integer(),
  transaction_type: text().notNull(),
  recipient_name: text().notNull(),
  department_name: text().notNull(),
  purpose: text().notNull(),
  status: text().notNull().default('draft'),
  due_date: date({ mode: 'string' }),
  confirmed_at: timestamp({ withTimezone: true, mode: 'string' }),
  confirmed_by: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  reversal_reason: text(),
  reversed_at: timestamp({ withTimezone: true, mode: 'string' }),
  reversed_by: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  created_by: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  ...stamps(),
}, (t) => [
  check('disbursements_type_check', sql`${t.transaction_type} in ('material_issue','asset_handover','asset_borrow')`),
  check('disbursements_status_check', sql`${t.status} in ('draft','confirmed','active_borrow','partially_returned','returned','reversed','cancelled')`),
  index('disbursements_status_index').on(t.status),
  index('disbursements_created_index').on(t.created_at),
])

export const disbursementItems = pgTable('disbursement_items', {
  id: uuid().primaryKey().defaultRandom(),
  disbursement_id: uuid().notNull().references(() => disbursements.id, { onDelete: 'restrict' }),
  item_id: uuid().notNull().references(() => items.id, { onDelete: 'restrict' }),
  requested_qty: integer().notNull(),
  issued_qty: integer().notNull().default(0),
  returned_qty: integer().notNull().default(0),
  item_name_snapshot: text(),
  asset_no_snapshot: text(),
  serial_no_snapshot: text(),
  brand_snapshot: text(),
  model_snapshot: text(),
  unit_name_snapshot: text(),
  unit_price_snapshot: numeric({ precision: 12, scale: 2, mode: 'number' }).default(0),
  category_name_snapshot: text(),
  location_name_snapshot: text(),
  status: text().notNull().default('pending'),
}, (t) => [
  check('disbursement_items_requested_qty_check', sql`${t.requested_qty} > 0`),
  check('disbursement_items_issued_qty_check', sql`${t.issued_qty} >= 0`),
  check('disbursement_items_returned_qty_check', sql`${t.returned_qty} >= 0 and ${t.returned_qty} <= ${t.issued_qty}`),
  check('disbursement_items_status_check', sql`${t.status} in ('pending','issued','partially_returned','returned','reversed')`),
  index('disbursement_items_doc_index').on(t.disbursement_id),
  index('disbursement_items_item_index').on(t.item_id),
])

export const stockMovements = pgTable('stock_movements', {
  id: uuid().primaryKey().defaultRandom(),
  item_id: uuid().notNull().references(() => items.id, { onDelete: 'restrict' }),
  disbursement_item_id: uuid().references(() => disbursementItems.id, { onDelete: 'restrict' }),
  delta: integer().notNull(),
  balance_after: integer().notNull(),
  movement_type: text().notNull(),
  created_by: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  created_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => [
  check('stock_movements_balance_check', sql`${t.balance_after} >= 0`),
  check('stock_movements_type_check', sql`${t.movement_type} in ('issue','reversal','adjust_audit')`),
  index('stock_movements_item_created_index').on(t.item_id, t.created_at),
])

export const assetCustodyLogs = pgTable('asset_custody_logs', {
  id: uuid().primaryKey().defaultRandom(),
  item_id: uuid().notNull().references(() => items.id, { onDelete: 'restrict' }),
  disbursement_item_id: uuid().notNull().references(() => disbursementItems.id, { onDelete: 'restrict' }),
  action: text().notNull(),
  quantity: integer().notNull().default(1),
  from_responsible: text(),
  to_responsible: text(),
  item_condition: text().notNull().default('normal'),
  note: text(),
  created_by: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  created_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => [
  check('asset_custody_action_check', sql`${t.action} in ('handover','borrow','return','reversal')`),
  check('asset_custody_condition_check', sql`${t.item_condition} in ('normal','damaged','lost')`),
  check('asset_custody_qty_check', sql`${t.quantity} > 0`),
  index('asset_custody_item_created_index').on(t.item_id, t.created_at),
])
const auth = pgSchema('private_auth')
export const credentials = auth.table('credentials', { user_id: uuid().primaryKey().references(() => profiles.id, { onDelete: 'cascade' }), password_hash: text().notNull() })
export const sessions = auth.table('sessions', { token_hash: text().primaryKey(), user_id: uuid().notNull().references(() => profiles.id, { onDelete: 'cascade' }), expires_at: timestamp({ withTimezone: true, mode: 'string' }).notNull(), created_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow() }, (t) => [index('sessions_user_index').on(t.user_id), index('sessions_expiry_index').on(t.expires_at)])
export const loginAttempts = auth.table('login_attempts', { key: text().primaryKey(), window_started_at: timestamp({ withTimezone:true,mode:'string' }).notNull().defaultNow(), attempts: integer().notNull() }, t=>[index('login_attempts_window_index').on(t.window_started_at)])
export const rateLimits = auth.table('rate_limits', { key: text().primaryKey(), window_started_at: timestamp({ withTimezone:true,mode:'string' }).notNull().defaultNow(), count: integer().notNull().default(0) }, t=>[index('rate_limits_window_index').on(t.window_started_at)])
