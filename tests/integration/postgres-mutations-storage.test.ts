import '../setup/dom'
import test, { afterEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const actor = '11111111-1111-4111-8111-111111111111'
const itemId = '22222222-2222-4222-8222-222222222222'
let profile: { id: string; role: string; is_active: boolean } | null = { id: actor, role: 'staff', is_active: true }
let rows: Record<string, unknown>[] = []
let responseRows: Record<string, unknown>[][] = []
const queries: { sql: string; params: unknown[] }[] = []
function mockModule(path: string, exports: unknown) {
  const filename = require.resolve(path)
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
}
mockModule('../../features/auth/queries', { getCurrentProfile: async () => profile })
mockModule('../../lib/postgres/request', { withUserDatabase: async (callback: (tx: unknown) => unknown) => callback({
  execute: async (query: SQL) => {
    queries.push(new PgDialect().sqlToQuery(query))
    return { rows: responseRows.shift() ?? rows }
  },
}) })
mockModule('../../lib/rate-limit', { checkRateLimit: async () => ({ success: true }) })
mockModule('../../features/admin/postgres-admin', { pgUpdateUserProfile: async () => ({ success: true }) })

const storage = import('../../lib/postgres/storage')
const actions = import('../../features/items/postgres-actions')
const settings = import('../../features/settings/postgres-actions')
const oldStorage = process.env.LOCAL_STORAGE_PATH
const oldBackend = process.env.DATA_BACKEND
process.env.DATA_BACKEND = 'postgres'
const prefix = join(tmpdir(), 'camms-storage-test-')
const directory = mkdtemp(prefix)
afterEach(() => { queries.length = 0; rows = []; responseRows = []; profile = { id: actor, role: 'staff', is_active: true } })
after(async () => {
  const path = await directory
  assert.ok(resolve(path).startsWith(resolve(prefix)))
  await rm(path, { recursive: true, force: true })
  if (oldStorage === undefined) delete process.env.LOCAL_STORAGE_PATH
  else process.env.LOCAL_STORAGE_PATH = oldStorage
  if (oldBackend === undefined) delete process.env.DATA_BACKEND
  else process.env.DATA_BACKEND = oldBackend
})

test('private image paths reject traversal, foreign origins, and unsupported formats', async () => {
  const { resolveLocalItemImageUrl } = await storage
  const good = `/api/files/item-images/${actor}/${itemId}.png`
  assert.equal(resolveLocalItemImageUrl(good), good)
  for (const value of [`https://evil.example${good}`, `${good}?x=1`, '/api/files/../../secret', good.replace('.png', '.svg'), good.replace(actor, '..')]) {
    assert.equal(resolveLocalItemImageUrl(value), null)
  }
})

test('viewer and inactive users cannot mutate items or write image files', async () => {
  const { mutatePostgresItems } = await actions
  const { uploadLocalItemImage } = await storage
  for (const denied of [{ id: actor, role: 'viewer', is_active: true }, { id: actor, role: 'admin', is_active: false }, null]) {
    profile = denied
    assert.equal((await mutatePostgresItems([itemId], 'delete')).success, false)
    await assert.rejects(uploadLocalItemImage(new File(['bad'], 'photo.png', { type: 'image/png' })), /Unauthorized/)
  }
  assert.equal(queries.length, 0)
})

test('bulk updates reject invalid ids and unrecognized status before querying', async () => {
  const { mutatePostgresItems } = await actions
  assert.equal((await mutatePostgresItems(["'); delete from items;--"], 'delete')).success, false)
  assert.equal((await mutatePostgresItems([itemId], 'update', { status: "active'; delete from items;--" })).success, false)
  assert.equal(queries.length, 0)
})

test('image content, size, authenticated attachment, and cleanup are enforced', async () => {
  process.env.LOCAL_STORAGE_PATH = await directory
  const { uploadLocalItemImage, readLocalItemImage, deleteLocalItemImage } = await storage
  await assert.rejects(uploadLocalItemImage(new File(['<svg>'], 'photo.png', { type: 'image/png' })))
  await assert.rejects(uploadLocalItemImage(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'photo.png', { type: 'image/png' })))
  const bytes = new Uint8Array([137,80,78,71,13,10,26,10])
  const url = await uploadLocalItemImage(new File([bytes], 'unsafe../photo.png', { type: 'image/png' }))
  assert.ok(url.startsWith(`/api/files/item-images/${actor}/`))
  assert.equal(await readLocalItemImage(url), null)
  rows = [{ id: itemId }]
  assert.equal((await readLocalItemImage(url))?.contentType, 'image/png')
  assert.equal((await deleteLocalItemImage(url)).success, true)
  assert.ok(await readLocalItemImage(url), 'referenced images must not be removed')
  profile = null
  assert.equal(await readLocalItemImage(url), null)
  profile = { id: actor, role: 'staff', is_active: true }
  rows = []
  assert.equal((await deleteLocalItemImage(url)).success, true)
  rows = [{ id: itemId }]
  assert.equal(await readLocalItemImage(url), null)
})

test('metadata rejects deactivation while a live item refers to the locked row', async () => {
  const { mutatePostgresMetadata } = await settings
  const form = new FormData()
  form.set('name', 'Category')
  rows = [{ id: itemId }]
  await assert.rejects(mutatePostgresMetadata('categories', 'update', form, itemId), error => {
    assert.ok((error as { digest: string }).digest.includes('error='))
    return true
  })
  assert.equal(queries.length, 2)
  assert.match(queries[0].sql, /for update/)
  assert.match(queries[1].sql, /deleted_at is null/)
  assert.ok(queries.every(query => !/update public|delete from|insert into/.test(query.sql)))
})

test('viewers cannot delete metadata and are denied before database access', async () => {
  const { mutatePostgresMetadata } = await settings
  profile = { id: actor, role: 'viewer', is_active: true }
  for (const table of ['categories', 'locations', 'units'] as const) {
    await assert.rejects(mutatePostgresMetadata(table, 'delete', undefined, itemId), error => {
      const digest = decodeURIComponent((error as { digest: string }).digest)
      assert.ok(digest.includes('error='))
      assert.ok(digest.includes('คุณไม่มีสิทธิ์จัดการตั้งค่า'))
      return true
    })
  }
  assert.equal(queries.length, 0)
})

test('metadata deletion reports failure when no row was deleted', async () => {
  const { mutatePostgresMetadata } = await settings
  profile = { id: actor, role: 'admin', is_active: true }
  responseRows = [[{ id: itemId }], [], []]
  await assert.rejects(mutatePostgresMetadata('units', 'delete', undefined, itemId), error => {
    assert.ok((error as { digest: string }).digest.includes('error='))
    return true
  })
  assert.equal(queries.length, 3)
  assert.match(queries[2].sql, /delete from.*returning id/)
})

test('staff metadata deletion reports success only after a row was deleted', async () => {
  const { mutatePostgresMetadata } = await settings
  responseRows = [[{ id: itemId }], [], [{ id: itemId }]]
  await assert.rejects(mutatePostgresMetadata('units', 'delete', undefined, itemId), error => {
    assert.ok((error as { digest: string }).digest.includes('message='))
    return true
  })
})
