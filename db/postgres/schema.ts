import { sql } from 'drizzle-orm'
import { pgTable, pgSchema, uuid, text, boolean, timestamp, integer, bigint, numeric, date, jsonb, index, uniqueIndex, check, foreignKey } from 'drizzle-orm/pg-core'

const stamps = () => ({ created_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow(), updated_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow() })
export const profiles = pgTable('profiles', {
  id: uuid().primaryKey().defaultRandom(), full_name: text().notNull(), email: text(),
  // Owner-only Navicat input; a BEFORE trigger hashes and clears this value.
  password: text(),
  role: text().notNull().default('user'), is_active: boolean().notNull().default(true),
  sidebar_order: jsonb().$type<string[]>().default([]), ...stamps(),
}, (t) => [uniqueIndex('profiles_email_unique').on(sql`lower(${t.email})`), check('profiles_role_check', sql`${t.role} in ('admin','user')`), check('profiles_password_cleared', sql`${t.password} is null`)])
export const categories = pgTable('categories', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  item_type: text().notNull().default('asset'),
  description: text(),
  color: text().notNull().default('#64748B'),
  icon: text().notNull().default('Tag'),
  is_active: boolean().notNull().default(true),
  ...stamps(),
}, t => [
  check('categories_item_type_check', sql`${t.item_type} in ('asset','material')`),
  uniqueIndex('categories_name_type_unique').on(t.name, t.item_type),
  uniqueIndex('categories_id_type_unique').on(t.id, t.item_type),
])
export const locations = pgTable('locations', {
  id: uuid().primaryKey().defaultRandom(), name: text().notNull(), building: text(), floor: text(), room: text(), department: text(), description: text(), is_active: boolean().notNull().default(true), ...stamps(),
})
export const units = pgTable('units', {
  id: uuid().primaryKey().defaultRandom(), name: text().notNull().unique(), is_active: boolean().notNull().default(true), ...stamps(),
})
export const inventoryRegistry = pgTable('inventory_registry', {
  id: uuid().primaryKey(), item_type: text().notNull(),
}, t => [check('inventory_registry_type_check', sql`${t.item_type} in ('asset','material')`), uniqueIndex('inventory_registry_id_type_unique').on(t.id, t.item_type)])

const inventoryColumns = () => ({
  id: uuid().primaryKey().defaultRandom(), item_name: text().notNull(), item_type: text().notNull(), qualification_status: text(),
  category_id: uuid().references(() => categories.id), location_id: uuid().references(() => locations.id), unit_id: uuid().references(() => units.id),
  quantity: integer().notNull().default(1), unit_price: numeric({ precision: 12, scale: 2, mode: 'number' }),
  asset_no: text(), serial_no: text(), brand: text(), model: text(), responsible_person: text(), status: text().notNull().default('active'), note: text(), image_url: text(),
  is_central: boolean().notNull().default(false),
  budget_source: text(), gfmis_number: text(), acquired_date: date({ mode: 'string' }),
  created_by: uuid().references(() => profiles.id, { onDelete: 'set null' }), updated_by: uuid().references(() => profiles.id, { onDelete: 'set null' }), deleted_by: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  deleted_at: timestamp({ withTimezone: true, mode: 'string' }),
  depreciation_enabled: boolean().notNull().default(false), depreciation_method: text(), depreciation_cost: numeric({ precision: 12, scale: 2, mode: 'number' }), depreciation_useful_life_years: integer(), depreciation_start_basis: text(), depreciation_start_date: date({ mode: 'string' }), depreciation_residual_value: numeric({ precision: 12, scale: 2, mode: 'number' }).notNull().default(1), ...stamps(),
})
export const items = pgTable('items', {
  ...inventoryColumns(),
  register_sequence: text(), asset_prefix: text(),
  register_accumulated_depreciation: numeric({ precision: 14, scale: 2, mode: 'number' }),
  register_book_value: numeric({ precision: 14, scale: 2, mode: 'number' }),
  register_as_of: date({ mode: 'string' }),
}, (t) => [
  foreignKey({ name: 'items_category_type_fk', columns: [t.category_id, t.item_type], foreignColumns: [categories.id, categories.item_type] }),
  check('items_register_amounts_check', sql`${t.register_book_value} is null or ${t.register_book_value} >= 0`),
  check('items_type_check', sql`${t.item_type} = 'asset'`),
  check('items_qualification_status_check', sql`${t.qualification_status} is null or ${t.qualification_status} in ('qualified','below_threshold')`),
  check('items_status_check', sql`${t.status} in ('active','spare','damaged','waiting_repair','inactive','disposed')`),
  check('items_quantity_check', sql`${t.quantity} >= 0`), check('items_price_check', sql`${t.unit_price} is null or ${t.unit_price} >= 0`),
  check('items_depreciation_check', sql`not ${t.depreciation_enabled} or coalesce((${t.item_type}='asset' and ${t.depreciation_method}='straight_line' and ${t.depreciation_cost}>1 and ${t.depreciation_useful_life_years}>0 and ${t.depreciation_start_basis} in ('acquired','available','manual') and ${t.depreciation_start_date} is not null and ${t.depreciation_residual_value}=1),false)`),
  uniqueIndex('items_asset_no_unique').on(t.asset_no).where(sql`${t.deleted_at} is null and ${t.asset_no} is not null`),
  uniqueIndex('items_serial_no_unique').on(t.serial_no).where(sql`${t.deleted_at} is null and ${t.serial_no} is not null`),
  index('items_qualification_status_index').on(t.qualification_status).where(sql`${t.deleted_at} is null`),
  index('items_updated_index').on(t.updated_at), index('items_category_index').on(t.category_id), index('items_location_index').on(t.location_id), index('items_type_status_index').on(t.item_type, t.status), index('items_is_central_index').on(t.is_central).where(sql`${t.deleted_at} is null`),
])
export const materials = pgTable('materials', {
  ...inventoryColumns(),
  metadata_version: bigint({ mode: 'number' }).notNull().default(1),
  stock_version: bigint({ mode: 'number' }).notNull().default(1),
  specification: text(), commodity_code: text(),
  minimum_quantity: integer(), maximum_quantity: integer(), fiscal_year: integer(), balance_as_of: date({ mode: 'string' }),
  opening_quantity: integer(), opening_amount: numeric({ precision: 14, scale: 2, mode: 'number' }),
  received_quantity: integer(), received_amount: numeric({ precision: 14, scale: 2, mode: 'number' }),
  issued_quantity: integer(), issued_amount: numeric({ precision: 14, scale: 2, mode: 'number' }),
  balance_amount: numeric({ precision: 14, scale: 2, mode: 'number' }),
}, t => [
  foreignKey({ name: 'materials_category_type_fk', columns: [t.category_id, t.item_type], foreignColumns: [categories.id, categories.item_type] }),
  check('materials_type_check', sql`${t.item_type} = 'material'`),
  check('materials_quantity_check', sql`${t.quantity} >= 0`),
  check('materials_price_check', sql`${t.unit_price} is null or ${t.unit_price} >= 0`),
  check('materials_depreciation_check', sql`not ${t.depreciation_enabled}`),
  check('materials_status_check', sql`${t.status} in ('active','spare','damaged','waiting_repair','inactive','disposed')`),
  check('materials_ledger_check', sql`coalesce(${t.minimum_quantity},0)>=0 and coalesce(${t.maximum_quantity},0)>=0 and coalesce(${t.opening_quantity},0)>=0 and coalesce(${t.received_quantity},0)>=0 and coalesce(${t.issued_quantity},0)>=0 and coalesce(${t.opening_amount},0)>=0 and coalesce(${t.received_amount},0)>=0 and coalesce(${t.issued_amount},0)>=0 and coalesce(${t.balance_amount},0)>=0`),
  index('materials_updated_index').on(t.updated_at), index('materials_category_index').on(t.category_id), index('materials_location_index').on(t.location_id),
])
export const auditLogs = pgTable('audit_logs', {
  id: uuid().primaryKey().defaultRandom(), user_id: uuid().references(() => profiles.id, { onDelete: 'set null' }), action: text().notNull(), target_table: text().notNull(), target_id: uuid(), old_data: jsonb(), new_data: jsonb(), created_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => [index('audit_created_index').on(t.created_at), index('audit_target_index').on(t.target_table, t.target_id)])

export const disbursementSequences = pgTable('disbursement_sequences', {
  fiscal_year: integer().notNull(),
  prefix: text().notNull(),
  current_val: integer().notNull().default(0),
}, (t) => [uniqueIndex('disbursement_sequences_pk').on(t.fiscal_year, t.prefix)])

export const requestBatches = pgTable('request_batches', {
  id: uuid().primaryKey().defaultRandom(),
  created_by: uuid().notNull().references(() => profiles.id),
  request_key: uuid().notNull(), payload_hash: text().notNull(),
  created_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, t => [uniqueIndex('request_batches_creator_key_unique').on(t.created_by, t.request_key)])

export const disbursements = pgTable('disbursements', {
  id: uuid().primaryKey().defaultRandom(),
  request_batch_id: uuid().references(() => requestBatches.id),
  document_no: text().unique(),
  fiscal_year: integer(),
  transaction_type: text().notNull(),
  recipient_name: text().notNull(),
  department_name: text().notNull(),
  purpose: text().notNull(),
  status: text().notNull().default('draft'),
  due_date: date({ mode: 'string' }),
  submitted_at: timestamp({ withTimezone: true, mode: 'string' }),
  handed_over_at: timestamp({ withTimezone: true, mode: 'string' }),
  handed_over_by: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  confirmed_at: timestamp({ withTimezone: true, mode: 'string' }),
  confirmed_by: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  reversal_reason: text(),
  reversed_at: timestamp({ withTimezone: true, mode: 'string' }),
  reversed_by: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  created_by: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  ...stamps(),
}, (t) => [
  check('disbursements_type_check', sql`${t.transaction_type} in ('material_issue','asset_handover','asset_borrow')`),
  check('disbursements_handover_time_check', sql`${t.handed_over_at} is not null or ${t.handed_over_by} is null`),
  index('disbursements_batch_index').on(t.request_batch_id).where(sql`${t.request_batch_id} is not null`),
  check('disbursements_status_check', sql`${t.status} in ('draft','pending_approval','confirmed','active_borrow','partially_returned','returned','reversed','cancelled','rejected')`),
  index('disbursements_status_index').on(t.status),
  index('disbursements_created_index').on(t.created_at),
])

export const disbursementItems = pgTable('disbursement_items', {
  id: uuid().primaryKey().defaultRandom(),
  disbursement_id: uuid().notNull().references(() => disbursements.id, { onDelete: 'restrict' }),
  item_id: uuid().notNull().references(() => inventoryRegistry.id, { onDelete: 'restrict' }),
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
  check('disbursement_items_issue_limit_check', sql`${t.issued_qty} <= ${t.requested_qty}`),
  check('disbursement_items_returned_qty_check', sql`${t.returned_qty} >= 0 and ${t.returned_qty} <= ${t.issued_qty}`),
  check('disbursement_items_status_check', sql`${t.status} in ('pending','issued','partially_returned','returned','reversed')`),
  index('disbursement_items_doc_index').on(t.disbursement_id),
  index('disbursement_items_item_index').on(t.item_id),
  uniqueIndex('disbursement_items_document_item_unique').on(t.disbursement_id, t.item_id),
])

export const materialStockDocuments = pgTable('material_stock_documents', {
  id: uuid().primaryKey().defaultRandom(),
  item_id: uuid().notNull().references(() => inventoryRegistry.id, { onDelete: 'restrict' }),
  kind: text().notNull(), request_key: uuid().notNull(),
  created_by: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  payload_hash: text().notNull(), quantity: integer().notNull(), accepted_quantity: integer().notNull().default(0),
  delta: integer().notNull(), reason: text().notNull(), reference: text().notNull(),
  disbursement_item_id: uuid().references(() => disbursementItems.id, { onDelete: 'restrict' }),
  opening_balance: bigint({ mode: 'number' }),
  created_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, t => [
  uniqueIndex('material_stock_documents_creator_key_unique').on(t.created_by, t.request_key),
  uniqueIndex('material_stock_opening_unique').on(t.item_id).where(sql`${t.kind}='opening'`),
  index('material_stock_documents_item_created').on(t.item_id,t.created_at),
  check('material_stock_documents_kind_check', sql`${t.kind} in ('receipt','count','return','opening')`),
  check('material_stock_documents_quantity_check', sql`${t.quantity}>=0`),
  check('material_stock_documents_accepted_check', sql`${t.accepted_quantity}>=0 and ${t.accepted_quantity}<=${t.quantity}`),
  check('material_stock_documents_reason_check', sql`length(btrim(${t.reason}))>0`),
  check('material_stock_documents_reference_check', sql`length(btrim(${t.reference}))>0`),
  check('material_stock_documents_return_check', sql`(${t.kind}='return')=(${t.disbursement_item_id} is not null)`),
  check('material_stock_documents_opening_check', sql`(${t.kind}='opening')=(${t.opening_balance} is not null)`),
])

export const stockMovements = pgTable('stock_movements', {
  id: uuid().primaryKey().defaultRandom(),
  item_id: uuid().notNull().references(() => inventoryRegistry.id, { onDelete: 'restrict' }),
  disbursement_item_id: uuid().references(() => disbursementItems.id, { onDelete: 'restrict' }),
  stock_document_id: uuid().references(() => materialStockDocuments.id, { onDelete: 'restrict' }),
  delta: integer().notNull(),
  balance_after: integer().notNull(),
  movement_type: text().notNull(),
  created_by: uuid().references(() => profiles.id, { onDelete: 'set null' }),
  created_at: timestamp({ withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => [
  check('stock_movements_balance_check', sql`${t.balance_after} >= 0`),
  check('stock_movements_type_check', sql`${t.movement_type} in ('issue','reversal','adjust_audit','receipt','material_return')`),
  uniqueIndex('stock_movements_document_unique').on(t.stock_document_id).where(sql`${t.stock_document_id} is not null`),
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
