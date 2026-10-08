import '../setup/dom'
import test, { describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { logger, type LogPayload } from '@/lib/logging'

const actor = '11111111-1111-4111-8111-111111111111'
const targetId = '22222222-2222-4222-8222-222222222222'
let profile: { id: string; role: string; is_active: boolean } | null = { id: actor, role: 'admin', is_active: true }
let rows: Record<string, unknown>[] = []
let responseRows: Record<string, unknown>[][] = []
const queries: { sql: string; params: unknown[] }[] = []

function mockModule(path: string, exports: unknown) {
  const filename = require.resolve(path)
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
}

mockModule('../../features/auth/queries', { getCurrentProfile: async () => profile })
mockModule('../../lib/postgres/request', {
  withUserDatabase: async (callback: (tx: unknown) => unknown) =>
    callback({
      execute: async (query: SQL) => {
        const statement = new PgDialect().sqlToQuery(query)
        queries.push(statement)
        return { rows: responseRows.shift() ?? rows }
      },
    }),
})
mockModule('../../lib/rate-limit', { checkRateLimit: async () => ({ success: true }) })
mockModule('../../features/admin/postgres-admin', { pgUpdateUserProfile: async () => ({ success: true }) })

const settingsActions = import('../../features/settings/postgres-actions')

async function callMutatePostgresMetadata(
  table: 'categories' | 'locations' | 'units',
  operation: 'create' | 'update' | 'delete',
  formData?: FormData,
  id?: string
): Promise<string> {
  const { mutatePostgresMetadata } = await settingsActions
  try {
    await mutatePostgresMetadata(table, operation, formData, id)
    assert.fail('Expected mutatePostgresMetadata to redirect')
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'message' in err && (err as Error).message === 'NEXT_REDIRECT') {
      const digest = (err as { digest?: string }).digest || ''
      return decodeURIComponent(digest)
    }
    throw err
  }
}

describe('Settings Postgres Metadata Mutations Audit Logging', () => {
  let auditLogs: LogPayload[] = []
  let originalLoggerInfo: typeof logger.info
  const originalDataBackend = process.env.DATA_BACKEND

  beforeEach(() => {
    process.env.DATA_BACKEND = 'postgres'
    auditLogs = []
    queries.length = 0
    rows = []
    responseRows = []
    profile = { id: actor, role: 'admin', is_active: true }

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
    if (originalDataBackend !== undefined) {
      process.env.DATA_BACKEND = originalDataBackend
    } else {
      delete process.env.DATA_BACKEND
    }
    queries.length = 0
    rows = []
    responseRows = []
    auditLogs = []
  })

  describe('Successful mutations record audit logs', () => {
    test('create category records audit log and redirects with success', async () => {
      const form = new FormData()
      form.set('name', 'IT Equipment')
      form.set('description', 'Office computing equipment')
      form.set('is_active', 'on')

      const redirectDigest = await callMutatePostgresMetadata('categories', 'create', form)
      assert.ok(redirectDigest.includes('tab=categories'))
      assert.ok(redirectDigest.includes('message='))
      assert.ok(!redirectDigest.includes('error='))

      // Verify audit log captured via logger
      assert.equal(auditLogs.length, 1)
      const log = auditLogs[0]
      assert.equal(log.operation, 'create')
      assert.equal(log.feature, 'settings')
      assert.equal(log.userId, actor)
      assert.equal(log.status, 'success')

      const details = log.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'categories')
      assert.equal(details.targetId, undefined)
      assert.deepEqual(details.newValues, {
        name: 'IT Equipment',
        description: 'Office computing equipment',
        is_active: true,
      })

      // Verify audit log persisted to database
      const auditDbQuery = queries.find(
        (q) => q.sql.includes('insert into public.audit_logs') && q.params.includes('create') && q.params.includes('categories')
      )
      assert.ok(auditDbQuery, 'Expected postgres insert query into public.audit_logs')
    })

    test('update location records audit log with targetId and new values', async () => {
      // Setup mock responses:
      // 1: Row lock select returns the existing record
      // Subsequent queries return empty rows
      responseRows = [[{ id: targetId }]]

      const form = new FormData()
      form.set('name', 'Server Room 101')
      form.set('building', 'Main Building')
      form.set('floor', '1')
      form.set('room', '101')
      form.set('department', 'Information Technology')
      form.set('description', 'Primary network closet')
      form.set('is_active', 'on')

      const redirectDigest = await callMutatePostgresMetadata('locations', 'update', form, targetId)
      assert.ok(redirectDigest.includes('tab=locations'))
      assert.ok(redirectDigest.includes('message='))

      assert.equal(auditLogs.length, 1)
      const log = auditLogs[0]
      assert.equal(log.operation, 'update')
      assert.equal(log.feature, 'settings')
      assert.equal(log.userId, actor)
      assert.equal(log.status, 'success')

      const details = log.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'locations')
      assert.equal(details.targetId, targetId)
      assert.deepEqual(details.newValues, {
        name: 'Server Room 101',
        building: 'Main Building',
        floor: '1',
        room: '101',
        department: 'Information Technology',
        description: 'Primary network closet',
        is_active: true,
      })

      const auditDbQuery = queries.find(
        (q) => q.sql.includes('insert into public.audit_logs') && q.params.includes('update') && q.params.includes('locations')
      )
      assert.ok(auditDbQuery, 'Expected postgres insert query into public.audit_logs for location update')
    })

    test('staff member can update category and emits audit log with staff userId', async () => {
      profile = { id: 'staff-user-456', role: 'staff', is_active: true }
      responseRows = [[{ id: targetId }]]

      const form = new FormData()
      form.set('name', 'Consumables')
      form.set('description', 'Stationery and supplies')
      form.set('is_active', 'on')

      const redirectDigest = await callMutatePostgresMetadata('categories', 'update', form, targetId)
      assert.ok(redirectDigest.includes('tab=categories'))
      assert.ok(redirectDigest.includes('message='))

      assert.equal(auditLogs.length, 1)
      const log = auditLogs[0]
      assert.equal(log.operation, 'update')
      assert.equal(log.feature, 'settings')
      assert.equal(log.userId, 'staff-user-456')

      const details = log.details as Record<string, unknown>
      assert.equal(details.targetType, 'categories')
      assert.equal(details.targetId, targetId)
    })

    test('delete unit records audit log with targetId', async () => {
      // Setup mock responses:
      // 1: Row lock select returns the existing record
      // 2: Usage check returns empty (no items using this unit)
      // 3: Delete returning id returns deleted record
      responseRows = [
        [{ id: targetId }],
        [],
        [{ id: targetId }],
      ]

      const redirectDigest = await callMutatePostgresMetadata('units', 'delete', undefined, targetId)
      assert.ok(redirectDigest.includes('tab=units'))
      assert.ok(redirectDigest.includes('message='))

      assert.equal(auditLogs.length, 1)
      const log = auditLogs[0]
      assert.equal(log.operation, 'delete')
      assert.equal(log.feature, 'settings')
      assert.equal(log.userId, actor)
      assert.equal(log.status, 'success')

      const details = log.details as Record<string, unknown>
      assert.equal(details.audit, true)
      assert.equal(details.targetType, 'units')
      assert.equal(details.targetId, targetId)
      assert.equal(details.newValues, undefined)

      const auditDbQuery = queries.find(
        (q) => q.sql.includes('insert into public.audit_logs') && q.params.includes('delete') && q.params.includes('units')
      )
      assert.ok(auditDbQuery, 'Expected postgres insert query into public.audit_logs for unit delete')
    })
  })

  describe('Unauthorized attempts do not emit audit logs', () => {
    test('viewer role cannot create metadata and emits no audit log', async () => {
      profile = { id: 'viewer-user', role: 'viewer', is_active: true }

      const form = new FormData()
      form.set('name', 'Unauthorized Cat')
      form.set('description', '')

      const redirectDigest = await callMutatePostgresMetadata('categories', 'create', form)
      assert.ok(redirectDigest.includes('error='))
      assert.ok(redirectDigest.includes('คุณไม่มีสิทธิ์จัดการตั้งค่า'))
      assert.equal(auditLogs.length, 0)
      assert.equal(queries.length, 0)
    })

    test('viewer role cannot update metadata and emits no audit log', async () => {
      profile = { id: 'viewer-user', role: 'viewer', is_active: true }

      const form = new FormData()
      form.set('name', 'Unauthorized Edit')
      form.set('is_active', 'on')

      const redirectDigest = await callMutatePostgresMetadata('units', 'update', form, targetId)
      assert.ok(redirectDigest.includes('error='))
      assert.ok(redirectDigest.includes('คุณไม่มีสิทธิ์จัดการตั้งค่า'))
      assert.equal(auditLogs.length, 0)
      assert.equal(queries.length, 0)
    })

    test('viewer role cannot delete metadata and emits no audit log', async () => {
      profile = { id: 'viewer-user', role: 'viewer', is_active: true }

      const redirectDigest = await callMutatePostgresMetadata('locations', 'delete', undefined, targetId)
      assert.ok(redirectDigest.includes('error='))
      assert.ok(redirectDigest.includes('คุณไม่มีสิทธิ์จัดการตั้งค่า'))
      assert.equal(auditLogs.length, 0)
      assert.equal(queries.length, 0)
    })

    test('inactive admin cannot mutate and emits no audit log', async () => {
      profile = { id: actor, role: 'admin', is_active: false }

      const form = new FormData()
      form.set('name', 'Inactive Admin')

      const redirectDigest = await callMutatePostgresMetadata('categories', 'create', form)
      assert.ok(redirectDigest.includes('error='))
      assert.ok(redirectDigest.includes('คุณไม่มีสิทธิ์จัดการตั้งค่า'))
      assert.equal(auditLogs.length, 0)
      assert.equal(queries.length, 0)
    })

    test('unauthenticated user cannot mutate and emits no audit log', async () => {
      profile = null

      const form = new FormData()
      form.set('name', 'Anon Category')

      const redirectDigest = await callMutatePostgresMetadata('categories', 'create', form)
      assert.ok(redirectDigest.includes('error='))
      assert.ok(redirectDigest.includes('คุณไม่มีสิทธิ์จัดการตั้งค่า'))
      assert.equal(auditLogs.length, 0)
      assert.equal(queries.length, 0)
    })
  })

  describe('Validation and database failures do not emit audit logs', () => {
    test('invalid uuid on update emits no audit log', async () => {
      const form = new FormData()
      form.set('name', 'Bad UUID Category')

      const redirectDigest = await callMutatePostgresMetadata('categories', 'update', form, 'invalid-uuid-format')
      assert.ok(redirectDigest.includes('error='))
      assert.ok(redirectDigest.includes('รหัสข้อมูลไม่ถูกต้อง'))
      assert.equal(auditLogs.length, 0)
      assert.equal(queries.length, 0)
    })

    test('invalid uuid on delete emits no audit log', async () => {
      const redirectDigest = await callMutatePostgresMetadata('categories', 'delete', undefined, 'invalid-uuid-format')
      assert.ok(redirectDigest.includes('error='))
      assert.ok(redirectDigest.includes('รหัสข้อมูลไม่ถูกต้อง'))
      assert.equal(auditLogs.length, 0)
      assert.equal(queries.length, 0)
    })

    test('empty name fails schema validation and emits no audit log', async () => {
      const form = new FormData()
      form.set('name', '   ')

      const redirectDigest = await callMutatePostgresMetadata('categories', 'create', form)
      assert.ok(redirectDigest.includes('error='))
      assert.ok(redirectDigest.includes('กรุณาตรวจสอบข้อมูลในฟอร์ม'))
      assert.equal(auditLogs.length, 0)
      assert.equal(queries.length, 0)
    })

    test('target not found on update emits no audit log', async () => {
      // Row lock select returns empty
      responseRows = [[]]

      const form = new FormData()
      form.set('name', 'Missing Category')

      const redirectDigest = await callMutatePostgresMetadata('categories', 'update', form, targetId)
      assert.ok(redirectDigest.includes('error='))
      assert.ok(redirectDigest.includes('ไม่พบข้อมูลที่ต้องการเปลี่ยนแปลง'))
      assert.equal(auditLogs.length, 0)
    })

    test('delete blocked when items reference target and emits no audit log', async () => {
      // Target exists, but usage check finds a referencing item
      responseRows = [
        [{ id: targetId }],
        [{ id: 'item-referencing-id' }],
      ]

      const redirectDigest = await callMutatePostgresMetadata('locations', 'delete', undefined, targetId)
      assert.ok(redirectDigest.includes('error='))
      assert.ok(redirectDigest.includes('ข้อมูลนี้กำลังถูกใช้งานโดยพัสดุในระบบ'))
      assert.equal(auditLogs.length, 0)
    })

    test('delete returning no rows emits no audit log', async () => {
      // Target exists, usage check clear, but delete returning id is empty
      responseRows = [
        [{ id: targetId }],
        [],
        [],
      ]

      const redirectDigest = await callMutatePostgresMetadata('units', 'delete', undefined, targetId)
      assert.ok(redirectDigest.includes('error='))
      assert.ok(redirectDigest.includes('ไม่พบข้อมูลที่สามารถลบได้'))
      assert.equal(auditLogs.length, 0)
    })
  })
})
