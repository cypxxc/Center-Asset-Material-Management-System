/**
 * Regression tests for readLocalItemImage catch narrowing.
 *
 * Guards against the vulnerability where a bare catch {} caused any exception
 * from withUserDatabase (e.g., DB timeout) to silently enable the unauthenticated
 * image-access fallback. Only AuthorizationError should trigger the fallback.
 */
import '../setup/dom'
import { test, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AuthorizationError } from '@/lib/errors'

let mockWithUserDb: ((callback: (tx: { execute: () => Promise<{ rows: unknown[] }> }) => Promise<unknown>) => Promise<unknown>) | null = null
let mockGetDbExecuteCalls = 0
let mockGetDbResult: { rows: unknown[] } = { rows: [] }

function mockModule(path: string, exports: unknown) {
  const filename = require.resolve(path)
  require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
}

mockModule('../../lib/postgres/request', {
  withUserDatabase: async (callback: (tx: { execute: () => Promise<{ rows: unknown[] }> }) => Promise<unknown>) => {
    if (mockWithUserDb) return mockWithUserDb(callback)
    return callback({ execute: async () => ({ rows: [] }) })
  },
})

mockModule('../../lib/postgres/db', {
  getDatabase: () => ({
    execute: async () => {
      mockGetDbExecuteCalls++
      return mockGetDbResult
    },
  }),
})

const storagePromise = import('@/lib/postgres/storage')

// ── resolveLocalItemImageUrl validation ──────────────────────────────────────

test('resolveLocalItemImageUrl accepts a valid local image path', async () => {
  const { resolveLocalItemImageUrl } = await storagePromise
  const valid = '/api/files/item-images/a1b2c3d4-e5f6-7890-abcd-ef1234567890/deadbeef-dead-beef-dead-beefdeadbeef.jpg'
  assert.equal(resolveLocalItemImageUrl(valid), valid)
})

test('resolveLocalItemImageUrl rejects null', async () => {
  const { resolveLocalItemImageUrl } = await storagePromise
  assert.equal(resolveLocalItemImageUrl(null), null)
})

test('resolveLocalItemImageUrl rejects undefined', async () => {
  const { resolveLocalItemImageUrl } = await storagePromise
  assert.equal(resolveLocalItemImageUrl(undefined), null)
})

test('resolveLocalItemImageUrl rejects path traversal attempts', async () => {
  const { resolveLocalItemImageUrl } = await storagePromise
  assert.equal(resolveLocalItemImageUrl('/api/files/item-images/../../../etc/passwd'), null)
  assert.equal(resolveLocalItemImageUrl('/api/files/item-images/%2e%2e%2f/etc/passwd'), null)
})

test('resolveLocalItemImageUrl rejects non-uuid path segments', async () => {
  const { resolveLocalItemImageUrl } = await storagePromise
  assert.equal(resolveLocalItemImageUrl('/api/files/item-images/not-a-uuid/also-not-a-uuid.jpg'), null)
})

test('resolveLocalItemImageUrl rejects unsupported extension', async () => {
  const { resolveLocalItemImageUrl } = await storagePromise
  const withGif = '/api/files/item-images/a1b2c3d4-e5f6-7890-abcd-ef1234567890/deadbeef-dead-beef-dead-beefdeadbeef.gif'
  assert.equal(resolveLocalItemImageUrl(withGif), null)
})

test('resolveLocalItemImageUrl rejects external URLs', async () => {
  const { resolveLocalItemImageUrl } = await storagePromise
  assert.equal(resolveLocalItemImageUrl('https://example.com/item-images/foo.jpg'), null)
})

test('resolveLocalItemImageUrl accepts webp and png extensions', async () => {
  const { resolveLocalItemImageUrl } = await storagePromise
  const base = '/api/files/item-images/a1b2c3d4-e5f6-7890-abcd-ef1234567890/deadbeef-dead-beef-dead-beefdeadbeef'
  assert.ok(resolveLocalItemImageUrl(`${base}.webp`))
  assert.ok(resolveLocalItemImageUrl(`${base}.png`))
})

// ── readLocalItemImage catch narrowing regression tests ───────────────────────

const userUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const fileUuid = 'deadbeef-dead-beef-dead-beefdeadbeef'
const sampleUrl = `/api/files/item-images/${userUuid}/${fileUuid}.png`

let tempStorageDir: string | null = null
const originalStoragePath = process.env.LOCAL_STORAGE_PATH

beforeEach(() => {
  mockWithUserDb = null
  mockGetDbExecuteCalls = 0
  mockGetDbResult = { rows: [] }
})

after(async () => {
  if (tempStorageDir) {
    await rm(tempStorageDir, { recursive: true, force: true }).catch(() => {})
  }
  if (originalStoragePath === undefined) delete process.env.LOCAL_STORAGE_PATH
  else process.env.LOCAL_STORAGE_PATH = originalStoragePath
})

test('readLocalItemImage returns null for invalid image path without touching database', async () => {
  const { readLocalItemImage } = await storagePromise
  const result = await readLocalItemImage('invalid-path')
  assert.equal(result, null)
  assert.equal(mockGetDbExecuteCalls, 0)
})

test('readLocalItemImage uses withUserDatabase when authenticated and succeeds', async () => {
  const { readLocalItemImage } = await storagePromise
  if (!tempStorageDir) {
    tempStorageDir = await mkdtemp(join(tmpdir(), 'camms-unit-storage-'))
    process.env.LOCAL_STORAGE_PATH = tempStorageDir
  }
  const fileDir = join(tempStorageDir, 'item-images', userUuid)
  await mkdir(fileDir, { recursive: true })
  await writeFile(join(fileDir, `${fileUuid}.png`), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))

  mockWithUserDb = async (callback) => callback({
    execute: async () => ({ rows: [{ id: 'item-1' }] }),
  })

  const result = await readLocalItemImage(sampleUrl)
  assert.ok(result)
  assert.equal(result.contentType, 'image/png')
  assert.equal(mockGetDbExecuteCalls, 0, 'fallback getDatabase must not be called when authenticated user succeeds')
})

test('readLocalItemImage falls back to getDatabase when withUserDatabase throws AuthorizationError', async () => {
  const { readLocalItemImage } = await storagePromise
  if (!tempStorageDir) {
    tempStorageDir = await mkdtemp(join(tmpdir(), 'camms-unit-storage-'))
    process.env.LOCAL_STORAGE_PATH = tempStorageDir
  }
  const fileDir = join(tempStorageDir, 'item-images', userUuid)
  await mkdir(fileDir, { recursive: true })
  await writeFile(join(fileDir, `${fileUuid}.png`), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))

  // Simulate unauthenticated request: withUserDatabase throws AuthorizationError
  mockWithUserDb = async () => {
    throw new AuthorizationError('กรุณาเข้าสู่ระบบ')
  }
  mockGetDbResult = { rows: [{ id: 'item-1' }] }

  const result = await readLocalItemImage(sampleUrl)
  assert.ok(result)
  assert.equal(result.contentType, 'image/png')
  assert.equal(mockGetDbExecuteCalls, 1, 'fallback getDatabase must be called exactly once for AuthorizationError')
})

test('readLocalItemImage re-throws non-auth errors (e.g. DB timeout) without falling back to getDatabase', async () => {
  const { readLocalItemImage } = await storagePromise

  // Simulate infrastructure failure: DB connection timeout
  mockWithUserDb = async () => {
    throw new Error('Connection terminated unexpectedly (timeout)')
  }
  mockGetDbResult = { rows: [{ id: 'item-1' }] }

  await assert.rejects(
    async () => readLocalItemImage(sampleUrl),
    { message: 'Connection terminated unexpectedly (timeout)' },
    'Non-AuthorizationError must be re-thrown and not caught by unauthenticated fallback'
  )
  assert.equal(mockGetDbExecuteCalls, 0, 'fallback getDatabase must NEVER be called on infrastructure errors')
})
