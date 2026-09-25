import '../setup/dom'
import test, { describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../mocks/supabase'
import { logger, type LogPayload } from '@/lib/logging'
import {
  bulkUpdateItems,
  bulkDeleteItems,
  hardDeleteItem,
  bulkHardDeleteItems,
} from '@/features/items/actions'

describe('Items Mutations Audit Logging Integration Tests', () => {
  let auditLogs: LogPayload[] = []
  let originalLoggerInfo: typeof logger.info
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  beforeEach(() => {
    mockSupabaseRegistry.clear()
    auditLogs = []

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key'

    originalLoggerInfo = logger.info
    logger.info = (payload: LogPayload) => {
      const details = payload.details as Record<string, unknown> | undefined
      if (details?.audit === true) {
        auditLogs.push(payload)
      }
      originalLoggerInfo(payload)
    }
  })

  afterEach(() => {
    logger.info = originalLoggerInfo
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey
    mockSupabaseRegistry.clear()
  })

  describe('bulkUpdateItems', () => {
    test('records audit log on successful bulk update', async () => {
      mockSupabaseRegistry.setAuth(
        { id: 'user-staff-1', email: 'staff@example.com' },
        { id: 'user-staff-1', email: 'staff@example.com', role: 'staff', is_active: true }
      )
      mockSupabaseRegistry.setRpcResponse('bulk_update_items_tx', 2)
      mockSupabaseRegistry.setTableResponse('audit_logs', [{ id: 'audit-log-1' }])

      const ids = [
        'c56a4180-65aa-42ec-a945-5fd21dec0538',
        'd78b5291-76bb-43fd-ba56-6fe32efd1649',
      ]
      const updates = { status: 'damaged' as const }

      const result = await bulkUpdateItems(ids, updates)

      assert.equal(result.success, true)
      assert.match(result.message ?? '', /แก้ไขสำเร็จ 2 จาก 2 รายการ/)

      const auditLog = auditLogs.find((log) => log.operation === 'bulk_update')
      assert.ok(auditLog, 'Expected audit log entry for bulk_update')
      assert.equal(auditLog.operation, 'bulk_update')
      assert.equal(auditLog.feature, 'items')
      assert.equal(auditLog.userId, 'user-staff-1')
      assert.equal(auditLog.status, 'success')

      const details = auditLog.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'items')
      assert.deepEqual(details.newValues, {
        ids,
        updates,
        count: 2,
      })
    })

    test('does not record audit log if bulk update fails validation or authorization', async () => {
      mockSupabaseRegistry.setAuth(
        { id: 'user-viewer-1', email: 'viewer@example.com' },
        { id: 'user-viewer-1', email: 'viewer@example.com', role: 'viewer', is_active: true }
      )

      const result = await bulkUpdateItems(['item-id-1'], { status: 'damaged' })
      assert.equal(result.success, false)
      assert.equal(auditLogs.length, 0, 'No audit log should be emitted on failed auth')
    })
  })

  describe('bulkDeleteItems', () => {
    test('records audit log on successful bulk soft delete', async () => {
      mockSupabaseRegistry.setAuth(
        { id: 'user-admin-1', email: 'admin@example.com' },
        { id: 'user-admin-1', email: 'admin@example.com', role: 'admin', is_active: true }
      )

      const ids = ['item-del-1', 'item-del-2']
      mockSupabaseRegistry.setTableResponse('items', [
        { id: 'item-del-1', image_url: null },
        { id: 'item-del-2', image_url: null },
      ])
      mockSupabaseRegistry.setTableResponse('audit_logs', [{ id: 'audit-log-2' }])

      const result = await bulkDeleteItems(ids)

      assert.equal(result.success, true)
      assert.match(result.message ?? '', /ลบเรียบร้อย 2 รายการ/)

      const auditLog = auditLogs.find((log) => log.operation === 'delete')
      assert.ok(auditLog, 'Expected audit log entry for delete')
      assert.equal(auditLog.operation, 'delete')
      assert.equal(auditLog.feature, 'items')
      assert.equal(auditLog.userId, 'user-admin-1')
      assert.equal(auditLog.status, 'success')

      const details = auditLog.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'items')
      assert.deepEqual(details.newValues, {
        ids,
        count: 2,
      })
    })

    test('does not record audit log if bulk delete unauthorized', async () => {
      mockSupabaseRegistry.setAuth(
        { id: 'user-viewer-2', email: 'viewer@example.com' },
        { id: 'user-viewer-2', email: 'viewer@example.com', role: 'viewer', is_active: true }
      )

      const result = await bulkDeleteItems(['item-del-1'])
      assert.equal(result.success, false)
      assert.equal(auditLogs.length, 0)
    })
  })

  describe('hardDeleteItem', () => {
    test('records audit log on successful single hard delete with old values', async () => {
      mockSupabaseRegistry.setAuth(
        { id: 'user-admin-2', email: 'admin@example.com' },
        { id: 'user-admin-2', email: 'admin@example.com', role: 'admin', is_active: true }
      )

      const itemId = 'item-hard-delete-1'
      const oldItemData = {
        item_name: 'Projector Epson',
        asset_no: 'ASSET-2024-001',
        serial_no: 'SN-EPSON-123',
        image_url: 'https://example.com/projector.jpg',
      }

      mockSupabaseRegistry.setTableResponse('items', [oldItemData])
      mockSupabaseRegistry.setTableResponse('audit_logs', [{ id: 'audit-log-3' }])

      const result = await hardDeleteItem(itemId)

      assert.equal(result.success, true)
      assert.equal(result.message, 'ลบรายการถาวรเรียบร้อยแล้ว')

      const auditLog = auditLogs.find((log) => log.operation === 'hard_delete')
      assert.ok(auditLog, 'Expected audit log entry for hard_delete')
      assert.equal(auditLog.operation, 'hard_delete')
      assert.equal(auditLog.feature, 'items')
      assert.equal(auditLog.userId, 'user-admin-2')
      assert.equal(auditLog.status, 'success')

      const details = auditLog.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'items')
      assert.equal(details.targetId, itemId)
      assert.deepEqual(details.oldValues, oldItemData)
    })

    test('does not record audit log if hard delete unauthorized', async () => {
      mockSupabaseRegistry.setAuth(
        { id: 'user-viewer-3', email: 'viewer@example.com' },
        { id: 'user-viewer-3', email: 'viewer@example.com', role: 'viewer', is_active: true }
      )

      const result = await hardDeleteItem('item-hard-delete-1')
      assert.equal(result.success, false)
      assert.equal(auditLogs.length, 0)
    })
  })

  describe('bulkHardDeleteItems', () => {
    test('records audit log on successful bulk hard delete', async () => {
      mockSupabaseRegistry.setAuth(
        { id: 'user-admin-3', email: 'admin@example.com' },
        { id: 'user-admin-3', email: 'admin@example.com', role: 'admin', is_active: true }
      )

      const ids = ['item-purge-1', 'item-purge-2', 'item-purge-3']
      const itemsToPurge = [
        { id: 'item-purge-1', item_name: 'P1', asset_no: 'A1', serial_no: null, image_url: null },
        { id: 'item-purge-2', item_name: 'P2', asset_no: 'A2', serial_no: null, image_url: null },
        { id: 'item-purge-3', item_name: 'P3', asset_no: 'A3', serial_no: null, image_url: null },
      ]

      mockSupabaseRegistry.setTableResponse('items', itemsToPurge)
      mockSupabaseRegistry.setTableResponse('audit_logs', [{ id: 'audit-log-4' }])

      const result = await bulkHardDeleteItems(ids)

      assert.equal(result.success, true)
      assert.match(result.message ?? '', /ลบถาวรเรียบร้อย 3 รายการ/)

      const auditLog = auditLogs.find((log) => log.operation === 'bulk_hard_delete')
      assert.ok(auditLog, 'Expected audit log entry for bulk_hard_delete')
      assert.equal(auditLog.operation, 'bulk_hard_delete')
      assert.equal(auditLog.feature, 'items')
      assert.equal(auditLog.userId, 'user-admin-3')
      assert.equal(auditLog.status, 'success')

      const details = auditLog.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'items')
      assert.deepEqual(details.newValues, {
        ids,
        count: 3,
      })
    })

    test('does not record audit log if empty ids provided', async () => {
      mockSupabaseRegistry.setAuth(
        { id: 'user-admin-3', email: 'admin@example.com' },
        { id: 'user-admin-3', email: 'admin@example.com', role: 'admin', is_active: true }
      )

      const result = await bulkHardDeleteItems([])
      assert.equal(result.success, false)
      assert.equal(auditLogs.length, 0)
    })
  })
})
