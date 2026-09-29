import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('00003_performance_indexes.sql contains required composite and foreign key indexes', () => {
  const migrationPath = path.join(process.cwd(), 'db/migrations/00003_performance_indexes.sql')
  assert.ok(fs.existsSync(migrationPath), 'Migration file 00003_performance_indexes.sql must exist')

  const sqlContent = fs.readFileSync(migrationPath, 'utf8')
  assert.ok(sqlContent.includes('idx_items_active_type_status'), 'Missing idx_items_active_type_status index')
  assert.ok(sqlContent.includes('idx_items_category_id'), 'Missing idx_items_category_id index')
  assert.ok(sqlContent.includes('idx_items_location_id'), 'Missing idx_items_location_id index')
  assert.ok(sqlContent.includes('idx_items_name_lower'), 'Missing idx_items_name_lower index')
})

test('00034_comprehensive_performance_indexes.sql contains required audit, trash, pagination, and RBAC indexes', () => {
  const migrationPath = path.join(process.cwd(), 'db/migrations/00034_comprehensive_performance_indexes.sql')
  assert.ok(fs.existsSync(migrationPath), 'Migration file 00034_comprehensive_performance_indexes.sql must exist')

  const sqlContent = fs.readFileSync(migrationPath, 'utf8')
  assert.ok(sqlContent.includes('idx_audit_logs_target'), 'Missing idx_audit_logs_target index')
  assert.ok(sqlContent.includes('idx_audit_logs_user_created'), 'Missing idx_audit_logs_user_created index')
  assert.ok(sqlContent.includes('idx_items_trash_deleted_at'), 'Missing idx_items_trash_deleted_at index')
  assert.ok(sqlContent.includes('idx_items_pagination_updated'), 'Missing idx_items_pagination_updated index')
  assert.ok(sqlContent.includes('idx_profiles_role_active'), 'Missing idx_profiles_role_active index')
})

test('20260929150000_performance_trgm_and_cursor_indexes.sql contains trigram and descending pagination indexes', () => {
  const migrationPath = path.join(process.cwd(), 'db/migrations/20260929150000_performance_trgm_and_cursor_indexes.sql')
  assert.ok(fs.existsSync(migrationPath), 'Migration file 20260929150000_performance_trgm_and_cursor_indexes.sql must exist')

  const sqlContent = fs.readFileSync(migrationPath, 'utf8')
  assert.ok(sqlContent.includes('pg_trgm'), 'Missing pg_trgm extension')
  assert.ok(sqlContent.includes('idx_items_trgm_name_fast'), 'Missing idx_items_trgm_name_fast index')
  assert.ok(sqlContent.includes('idx_items_trgm_asset_no_fast'), 'Missing idx_items_trgm_asset_no_fast index')
  assert.ok(sqlContent.includes('idx_items_trgm_serial_no_fast'), 'Missing idx_items_trgm_serial_no_fast index')
  assert.ok(sqlContent.includes('idx_items_pagination_updated_desc'), 'Missing idx_items_pagination_updated_desc index')
})

test('20260929160000_items_search_trgm_brand_model_responsible.sql contains trigram indexes for brand, model, responsible_person', () => {
  const migrationPath = path.join(process.cwd(), 'db/migrations/20260929160000_items_search_trgm_brand_model_responsible.sql')
  assert.ok(fs.existsSync(migrationPath), 'Migration file 20260929160000_items_search_trgm_brand_model_responsible.sql must exist')

  const sqlContent = fs.readFileSync(migrationPath, 'utf8')
  assert.ok(sqlContent.includes('pg_trgm'), 'Missing pg_trgm extension')
  assert.ok(sqlContent.includes('idx_items_trgm_brand'), 'Missing idx_items_trgm_brand index')
  assert.ok(sqlContent.includes('idx_items_trgm_model'), 'Missing idx_items_trgm_model index')
  assert.ok(sqlContent.includes('idx_items_trgm_responsible_person'), 'Missing idx_items_trgm_responsible_person index')
})
