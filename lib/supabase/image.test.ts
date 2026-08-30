import test from 'node:test'
import assert from 'node:assert/strict'
import { getTransformedImageUrl } from './image'

test('getTransformedImageUrl formats Supabase storage URLs with width, quality, and WebP format', () => {
  const input = 'https://xyz.supabase.co/storage/v1/object/public/item-images/photo.jpg'
  const output = getTransformedImageUrl(input, { width: 400, quality: 80, format: 'webp' })
  assert.equal(
    output,
    'https://xyz.supabase.co/storage/v1/render/image/public/item-images/photo.jpg?width=400&quality=80&format=webp'
  )
})

test('getTransformedImageUrl applies default options when no options passed', () => {
  const input = 'https://xyz.supabase.co/storage/v1/object/public/item-images/photo.jpg'
  const output = getTransformedImageUrl(input)
  assert.equal(
    output,
    'https://xyz.supabase.co/storage/v1/render/image/public/item-images/photo.jpg?width=600&quality=80&format=webp'
  )
})

test('getTransformedImageUrl handles format origin without adding format search param', () => {
  const input = 'https://xyz.supabase.co/storage/v1/object/public/item-images/photo.jpg'
  const output = getTransformedImageUrl(input, { width: 500, quality: 90, format: 'origin' })
  assert.equal(
    output,
    'https://xyz.supabase.co/storage/v1/render/image/public/item-images/photo.jpg?width=500&quality=90'
  )
})

test('getTransformedImageUrl returns fallback or original URL when non-Supabase storage URL provided', () => {
  assert.equal(getTransformedImageUrl(null), '')
  assert.equal(getTransformedImageUrl(undefined), '')
  assert.equal(getTransformedImageUrl(''), '')
  assert.equal(getTransformedImageUrl('https://example.com/other.png'), 'https://example.com/other.png')
  assert.equal(getTransformedImageUrl('blob:http://localhost:3000/xyz'), 'blob:http://localhost:3000/xyz')
  assert.equal(getTransformedImageUrl('data:image/png;base64,123'), 'data:image/png;base64,123')
})
