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
