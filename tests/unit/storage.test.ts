import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseStoragePathFromUrl, deleteItemStorageImage } from '@/lib/supabase/storage'

test('parseStoragePathFromUrl extracts relative file path from public Supabase URL', () => {
  const url = 'https://xyz.supabase.co/storage/v1/object/public/item-images/items/sample-image-123.webp'
  const path = parseStoragePathFromUrl(url)
  assert.equal(path, 'items/sample-image-123.webp')
})

test('parseStoragePathFromUrl extracts relative file path when root filename in bucket', () => {
  const url = 'https://xyz.supabase.co/storage/v1/object/public/item-images/sample-image-123.webp'
  const path = parseStoragePathFromUrl(url)
  assert.equal(path, 'sample-image-123.webp')
})

test('parseStoragePathFromUrl ignores URL query parameters', () => {
  const url = 'https://xyz.supabase.co/storage/v1/render/image/public/item-images/items/sample-image-123.webp?width=400&quality=80'
  const path = parseStoragePathFromUrl(url)
  assert.equal(path, 'items/sample-image-123.webp')
})

test('parseStoragePathFromUrl handles encoded characters properly', () => {
  const url = 'https://xyz.supabase.co/storage/v1/object/public/item-images/items/my%20sample%20image.png'
  const path = parseStoragePathFromUrl(url)
  assert.equal(path, 'items/my sample image.png')
})

test('parseStoragePathFromUrl returns null for invalid or external URLs', () => {
  assert.equal(parseStoragePathFromUrl(null), null)
  assert.equal(parseStoragePathFromUrl(undefined), null)
  assert.equal(parseStoragePathFromUrl(''), null)
  assert.equal(parseStoragePathFromUrl('https://images.unsplash.com/photo-123'), null)
  assert.equal(parseStoragePathFromUrl('https://example.com/item-images-fake/pic.png'), null)
})

test('deleteItemStorageImage returns success true when imageUrl is null or empty', async () => {
  const resNull = await deleteItemStorageImage(null)
  assert.deepEqual(resNull, { success: true })

  const resUndefined = await deleteItemStorageImage(undefined)
  assert.deepEqual(resUndefined, { success: true })

  const resEmpty = await deleteItemStorageImage('')
  assert.deepEqual(resEmpty, { success: true })

  const resExternal = await deleteItemStorageImage('https://images.unsplash.com/photo-123')
  assert.deepEqual(resExternal, { success: true })
})
