import assert from 'node:assert/strict'
import test from 'node:test'
import { resolvePrivateItemImageUrl, resolvePrivateItemImageUrlsBatch } from '../../lib/supabase/storage'

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

test('resolves multiple item image URLs in a single batch call', async () => {
  const calls: Array<{ paths: string[]; expiresIn: number }> = []

  const urls = [
    'https://xyz.supabase.co/storage/v1/object/public/item-images/items/img1.webp',
    null,
    'https://xyz.supabase.co/storage/v1/object/public/item-images/items/img2.webp',
  ]

  const results = await resolvePrivateItemImageUrlsBatch(
    urls,
    async (paths, expiresIn) => {
      calls.push({ paths, expiresIn })
      return {
        data: [
          { error: null, path: 'items/img1.webp', signedUrl: 'https://signed.example/img1' },
          { error: null, path: 'items/img2.webp', signedUrl: 'https://signed.example/img2' },
        ],
        error: null,
      }
    }
  )

  assert.deepEqual(results, [
    'https://signed.example/img1',
    null,
    'https://signed.example/img2',
  ])
  assert.deepEqual(calls, [{ paths: ['items/img1.webp', 'items/img2.webp'], expiresIn: 3600 }])
})
