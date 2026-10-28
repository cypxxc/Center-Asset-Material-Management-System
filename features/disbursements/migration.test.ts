import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  validateAvailableMigrationNumbers,
  splitSqlStatements,
} from '../../scripts/migration-utils'

test('migration 20261028000100 conforms to repository naming and order rules', () => {
  const migrationsDir = path.join(process.cwd(), 'db', 'migrations')
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

  assert.ok(files.includes('20261028000100_disbursement_ledger_and_custody.sql'))
  validateAvailableMigrationNumbers(files)

  const content = fs.readFileSync(path.join(migrationsDir, '20261028000100_disbursement_ledger_and_custody.sql'), 'utf8')
  const statements = splitSqlStatements(content)

  // Verify critical tables are created
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.disbursements'))
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.disbursement_items'))
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.stock_movements'))
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.asset_custody_logs'))
  assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.disbursement_sequences'))

  // Verify stored procedures and trigger
  assert.ok(content.includes('CREATE OR REPLACE FUNCTION public.confirm_disbursement_rpc'))
  assert.ok(content.includes('CREATE OR REPLACE FUNCTION public.return_disbursement_item_rpc'))
  assert.ok(content.includes('CREATE OR REPLACE FUNCTION public.reverse_disbursement_rpc'))
  assert.ok(content.includes('CREATE OR REPLACE FUNCTION public.validate_disbursement_item_type'))
  assert.ok(content.includes('CREATE TRIGGER on_disbursement_item_validate'))

  // Verify RLS policies are attached
  assert.ok(content.includes('ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY'))
  assert.ok(content.includes('ALTER TABLE public.disbursement_items ENABLE ROW LEVEL SECURITY'))
  assert.ok(content.includes('ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY'))
  assert.ok(content.includes('ALTER TABLE public.asset_custody_logs ENABLE ROW LEVEL SECURITY'))

  // Verify security grants
  assert.ok(content.includes('GRANT EXECUTE ON FUNCTION public.confirm_disbursement_rpc(uuid) TO authenticated'))
  assert.ok(content.includes('GRANT EXECUTE ON FUNCTION public.return_disbursement_item_rpc(uuid, integer, text, text) TO authenticated'))
  assert.ok(content.includes('GRANT EXECUTE ON FUNCTION public.reverse_disbursement_rpc(uuid, text) TO authenticated'))
  assert.ok(content.includes("v_caller_role NOT IN ('admin', 'staff')"))

  assert.ok(statements.length > 10)
})

test('disbursement migration SQL enforces row-level locking and immutable snapshots', () => {
  const migrationsDir = path.join(process.cwd(), 'db', 'migrations')
  const content = fs.readFileSync(path.join(migrationsDir, '20261028000100_disbursement_ledger_and_custody.sql'), 'utf8')

  // Verify FOR UPDATE locking on item rows
  assert.ok(content.includes('WHERE id = v_line.item_id AND deleted_at IS NULL\n    FOR UPDATE'))
  assert.ok(content.includes('WHERE id = p_disbursement_id\n  FOR UPDATE'))

  // Verify immutable snapshots populated
  assert.ok(content.includes('item_name_snapshot = v_item.item_name'))
  assert.ok(content.includes('asset_no_snapshot = v_item.asset_no'))
  assert.ok(content.includes('unit_price_snapshot = coalesce(v_item.unit_price, 0)'))

  // Verify ledger and custody logs in transaction
  assert.ok(content.includes('INSERT INTO public.stock_movements'))
  assert.ok(content.includes('INSERT INTO public.asset_custody_logs'))
  assert.ok(content.includes('INSERT INTO public.audit_logs'))

  // Verify reversal protection: cannot reverse if returned_qty > 0
  assert.ok(content.includes('WHERE disbursement_id = p_disbursement_id AND returned_qty > 0'))
})

test('migration 20261028000200 protects confirmed snapshots with database triggers', () => {
  const migrationsDir = path.join(process.cwd(), 'db', 'migrations')
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

  assert.ok(files.includes('20261028000200_protect_confirmed_disbursement_snapshots.sql'))
  validateAvailableMigrationNumbers(files)

  const content = fs.readFileSync(path.join(migrationsDir, '20261028000200_protect_confirmed_disbursement_snapshots.sql'), 'utf8')

  assert.ok(content.includes('CREATE OR REPLACE FUNCTION public.protect_disbursement_header_immutability'))
  assert.ok(content.includes('CREATE OR REPLACE FUNCTION public.protect_disbursement_item_immutability'))
  assert.ok(content.includes('CREATE TRIGGER on_disbursement_header_protect'))
  assert.ok(content.includes('CREATE TRIGGER on_disbursement_item_protect'))

  // Verify deletion protection on confirmed headers
  assert.ok(content.includes("OLD.status != 'draft' AND OLD.status != 'cancelled'"))
  // Verify snapshot immutability on lines
  assert.ok(content.includes('NEW.item_name_snapshot != OLD.item_name_snapshot'))
  assert.ok(content.includes('NEW.asset_no_snapshot != OLD.asset_no_snapshot'))
  assert.ok(content.includes('NEW.unit_price_snapshot != OLD.unit_price_snapshot'))
})
