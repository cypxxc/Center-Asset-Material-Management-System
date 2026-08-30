import assert from 'node:assert/strict'
import test from 'node:test'
import { resolvePrivateItemImageUrl } from '../../lib/supabase/storage'

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
