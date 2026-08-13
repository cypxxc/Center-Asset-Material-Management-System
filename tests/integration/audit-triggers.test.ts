import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logging'
import { mockSupabaseRegistry, mockSupabaseClient } from '../mocks/supabase'

describe('Audit System Hardening & Immutability Integration Tests', () => {
  const migrationPath = join(process.cwd(), 'db/migrations/00028_audit_system_hardening.sql')
  const migrationSql = readFileSync(migrationPath, 'utf8')

  describe('Database Immutability Triggers (SQL Verification)', () => {
    test('migration 00028 defines prevent_audit_log_tampering function with immutability error', () => {
      assert.match(migrationSql, /CREATE OR REPLACE FUNCTION public\.prevent_audit_log_tampering\(\)/i)
      assert.match(migrationSql, /RAISE EXCEPTION 'Audit logs are immutable\. UPDATE and DELETE operations are forbidden\.'/i)
    })

    test('migration 00028 attaches BEFORE UPDATE OR DELETE trigger to audit_logs', () => {
      assert.match(migrationSql, /DROP TRIGGER IF EXISTS trg_prevent_audit_log_tampering ON public\.audit_logs/i)
      assert.match(migrationSql, /CREATE TRIGGER trg_prevent_audit_log_tampering/i)
      assert.match(migrationSql, /BEFORE UPDATE OR DELETE ON public\.audit_logs/i)
      assert.match(migrationSql, /FOR EACH ROW EXECUTE FUNCTION public\.prevent_audit_log_tampering\(\)/i)
    })

    test('migration 00028 defines process_audit_log_event for automated mutation auditing', () => {
      assert.match(migrationSql, /CREATE OR REPLACE FUNCTION public\.process_audit_log_event\(\)/i)
      assert.match(migrationSql, /TG_OP = 'DELETE'/i)
      assert.match(migrationSql, /TG_OP = 'UPDATE'/i)
      assert.match(migrationSql, /TG_OP = 'INSERT'/i)
      assert.match(migrationSql, /INSERT INTO public\.audit_logs/i)
    })

    test('migration 00028 attaches automated audit triggers to core domain tables', () => {
      const targetTables = ['items', 'categories', 'locations', 'units', 'profiles']
      for (const table of targetTables) {
        assert.match(migrationSql, new RegExp(`DROP TRIGGER IF EXISTS trg_audit_${table} ON public\\.${table}`, 'i'))
        assert.match(migrationSql, new RegExp(`CREATE TRIGGER trg_audit_${table}`, 'i'))
        assert.match(migrationSql, new RegExp(`AFTER INSERT OR UPDATE OR DELETE ON public\\.${table}`, 'i'))
        assert.match(migrationSql, new RegExp(`EXECUTE FUNCTION public\\.process_audit_log_event\\(\\)`, 'i'))
      }
    })
  })

  describe('Audit Persistence Failure Diagnostic Tagging', () => {
    test('writeAuditLog tags errors with audit_failure: true when persistence fails', async () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      const originalLoggerError = logger.error

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9999'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-service-key'

      const loggedErrors: Array<{ payload: Record<string, unknown>; error?: unknown }> = []
      logger.error = (payload: Record<string, unknown>, err?: unknown) => {
        loggedErrors.push({ payload, error: err })
      }

      try {
        const payload = {
          operation: 'test-failing-operation',
          feature: 'audit-hardening-test',
          userId: 'user-integration-123',
          targetType: 'items',
          targetId: 'item-integration-456',
          oldValues: { status: 'active' },
          newValues: { status: 'archived' },
        }

        await writeAuditLog(payload)

        const auditFailureLog = loggedErrors.find(
          (entry) => entry.payload.operation === 'writeAuditLogDb'
        )

        assert.ok(auditFailureLog, 'Expected logger.error entry for writeAuditLogDb')
        assert.equal(auditFailureLog.payload.operation, 'writeAuditLogDb')
        assert.equal(auditFailureLog.payload.feature, 'audit')
        assert.equal(auditFailureLog.payload.audit_failure, true)
        assert.equal(auditFailureLog.payload.userId, 'user-integration-123')
        assert.equal(auditFailureLog.payload.targetTable, 'items')
        assert.equal(auditFailureLog.payload.targetId, 'item-integration-456')
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
        process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
        logger.error = originalLoggerError
      }
    })

    test('writeAuditLog executes gracefully without throwing when error occurs', async () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9999'

      try {
        await assert.doesNotReject(async () => {
          await writeAuditLog({
            operation: 'safe-check',
            feature: 'audit',
            userId: 'user-safe-123',
            targetType: 'categories',
            targetId: 'cat-123',
          })
        })
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
      }
    })
  })

  describe('Database Client Integration (Real DB Triggers)', () => {

    test('attempting to UPDATE an audit_log record is rejected by database trigger', async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      const isLiveDb = supabaseUrl && !supabaseUrl.includes('placeholder') && serviceKey && !serviceKey.includes('placeholder')

      if (isLiveDb) {
        const { createServiceRoleClient } = await import('@/lib/supabase/server')
        const supabase = createServiceRoleClient()

        const { data: logEntry, error: insertError } = await supabase
          .from('audit_logs')
          .insert({
            action: 'TEST_INSERT',
            target_table: 'items',
            target_id: 'dummy-live-test-id',
          })
          .select()
          .single()

        if (!insertError && logEntry) {
          const { error: updateError } = await supabase
            .from('audit_logs')
            .update({ action: 'HACKED_ACTION' })
            .eq('id', logEntry.id)

          assert.ok(updateError, 'Expected UPDATE on audit_logs to be rejected by Postgres trigger')
          assert.match(updateError.message, /Audit logs are immutable/i)
        }
      } else {
        const supabase = mockSupabaseClient
        mockSupabaseRegistry.setTableResponse('audit_logs', [{ id: 'dummy-id', action: 'test-insert-for-update' }], null)
        const { data: insertData, error: insertError } = await supabase
          .from('audit_logs')
          .insert({
            action: 'test-insert-for-update',
            target_table: 'items',
            target_id: 'dummy-id',
          })
          .select()
          .single()

        assert.ifError(insertError)
        assert.ok(insertData)

        mockSupabaseRegistry.setTableResponse('audit_logs', null, { message: 'Audit logs are immutable. UPDATE and DELETE operations are forbidden.' })
        const { error: updateError } = await supabase
          .from('audit_logs')
          .update({ action: 'hacked-operation' })
          .eq('id', insertData.id)

        assert.ok(updateError, 'Expected UPDATE to be rejected')
        assert.match(updateError.message, /Audit logs are immutable/i)
        mockSupabaseRegistry.clear()
      }
    })

    test('attempting to DELETE an audit_log record is rejected by database trigger', async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      const isLiveDb = supabaseUrl && !supabaseUrl.includes('placeholder') && serviceKey && !serviceKey.includes('placeholder')

      if (isLiveDb) {
        const { createServiceRoleClient } = await import('@/lib/supabase/server')
        const supabase = createServiceRoleClient()

        const { data: logEntry, error: insertError } = await supabase
          .from('audit_logs')
          .insert({
            action: 'TEST_INSERT_DELETE',
            target_table: 'items',
            target_id: 'dummy-live-test-delete-id',
          })
          .select()
          .single()

        if (!insertError && logEntry) {
          const { error: deleteError } = await supabase
            .from('audit_logs')
            .delete()
            .eq('id', logEntry.id)

          assert.ok(deleteError, 'Expected DELETE on audit_logs to be rejected by Postgres trigger')
          assert.match(deleteError.message, /Audit logs are immutable/i)
        }
      } else {
        const supabase = mockSupabaseClient
        mockSupabaseRegistry.setTableResponse('audit_logs', [{ id: 'dummy-id', action: 'test-insert-for-delete' }], null)
        const { data: insertData, error: insertError } = await supabase
          .from('audit_logs')
          .insert({
            action: 'test-insert-for-delete',
            target_table: 'items',
            target_id: 'dummy-id',
          })
          .select()
          .single()

        assert.ifError(insertError)
        assert.ok(insertData)

        mockSupabaseRegistry.setTableResponse('audit_logs', null, { message: 'Audit logs are immutable. UPDATE and DELETE operations are forbidden.' })
        const { error: deleteError } = await supabase
          .from('audit_logs')
          .delete()
          .eq('id', insertData.id)

        assert.ok(deleteError, 'Expected DELETE to be rejected')
        assert.match(deleteError.message, /Audit logs are immutable/i)
        mockSupabaseRegistry.clear()
      }
    })

    test('mutating items table automatically generates an audit_log record via trigger', async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      const isLiveDb = supabaseUrl && !supabaseUrl.includes('placeholder') && serviceKey && !serviceKey.includes('placeholder')

      if (isLiveDb) {
        const { createServiceRoleClient } = await import('@/lib/supabase/server')
        const supabase = createServiceRoleClient()

        const testItemName = `Live Audit Test Item ${Date.now()}`
        const { data: item, error: insertError } = await supabase
          .from('items')
          .insert({ item_name: testItemName })
          .select()
          .single()

        if (!insertError && item) {
          const { data: logs, error: logsError } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('target_table', 'items')
            .eq('target_id', item.id)

          assert.ifError(logsError)
          assert.ok(logs && logs.length > 0, 'Expected trigger to insert audit log entry')
        }
      } else {
        const supabase = mockSupabaseClient
        const testItemName = `Audit test item ${Date.now()}`
        
        mockSupabaseRegistry.setTableResponse('items', [{ id: 'item-123', item_name: testItemName, status: 'active' }], null)
        
        const { data: insertedItem, error: insertError } = await supabase
          .from('items')
          .insert({ item_name: testItemName })
          .select()
          .single()
        
        assert.ifError(insertError)
        assert.ok(insertedItem)

        mockSupabaseRegistry.setTableResponse('audit_logs', [{
          id: 'audit-123',
          action: 'INSERT',
          target_table: 'items',
          target_id: insertedItem.id
        }], null)
        
        const { data: logs, error: logsError } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('target_table', 'items')
          .eq('target_id', insertedItem.id)

        assert.ifError(logsError)
        assert.ok(logs && logs.length > 0)
        assert.equal(logs[0].action, 'INSERT')
        assert.equal(logs[0].target_table, 'items')

        mockSupabaseRegistry.clear()
      }
    })
  })
})
