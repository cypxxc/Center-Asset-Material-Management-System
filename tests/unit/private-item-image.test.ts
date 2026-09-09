import '../setup/server-only'
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolvePrivateItemImageUrl, resolvePrivateItemImageUrls } from '../../lib/supabase/storage'

test('batch signing deduplicates decoded paths and maps missing or failed paths to null', async () => {
  const calls: string[][] = []
  const base = 'https://example.com/storage/v1/object/public/item-images/'
  const result = await resolvePrivateItemImageUrls([base + 'a%20b', base + 'a%20b', base + 'missing', base + 'denied', null], async (paths, expiresIn) => {
    calls.push(paths)
    assert.equal(expiresIn, 3600)
    return { data: [{ path: 'denied', signedUrl: 'unsafe', error: 'denied' }, { path: 'a b', signedUrl: 'signed', error: null }], error: null }
  })
  assert.deepEqual(calls, [['a b', 'missing', 'denied']])
  assert.deepEqual(result, ['signed', 'signed', null, null, null])
})

test('batch signing skips absent images and hides images on storage failure', async () => {
  assert.deepEqual(await resolvePrivateItemImageUrls([null, undefined, 'invalid'], async () => { throw new Error('must not call') }), [null, null, null])
  assert.deepEqual(await resolvePrivateItemImageUrls(['https://example.com/item-images/a'], async () => ({ data: null, error: 'denied' })), [null])
})

test('resolves a stored item image URL to a short-lived signed URL', async () => {
  const calls: Array<{ path: string; expiresIn: number }> = []

  const result = await resolvePrivateItemImageUrl(
    'https://xyz.supabase.co/storage/v1/object/public/item-images/items/photo%201.webp',
    async (path, expiresIn) => {
      calls.push({ path, expiresIn })
      return { data: { signedUrl: 'https://signed.example/photo' }, error: null }
    }
  )

  assert.equal(result, 'https://signed.example/photo')
  assert.deepEqual(calls, [{ path: 'items/photo 1.webp', expiresIn: 3600 }])
})

test('hides a private item image when signing fails', async () => {
  const result = await resolvePrivateItemImageUrl(
    'https://xyz.supabase.co/storage/v1/object/public/item-images/photo.webp',
    async () => ({ data: null, error: { message: 'denied' } })
  )

  assert.equal(result, null)
})

test('keeps null item images without calling storage', async () => {
  let called = false
  const result = await resolvePrivateItemImageUrl(null, async () => {
    called = true
    return { data: { signedUrl: 'unexpected' }, error: null }
  })

  assert.equal(result, null)
  assert.equal(called, false)
})
