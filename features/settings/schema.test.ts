import assert from 'node:assert/strict'
import test from 'node:test'
import { categorySchema, locationSchema, unitSchema } from './schema'

test('categorySchema accepts a valid category and normalizes empty description', () => {
  const result = categorySchema.safeParse({
    name: 'Computer',
    description: '',
    is_active: 'on',
  })

  assert.equal(result.success, true)
  if (result.success) {
    assert.equal(result.data.description, null)
    assert.equal(result.data.is_active, true)
  }
})

test('locationSchema accepts building details and normalizes optional blanks', () => {
  const result = locationSchema.safeParse({
    name: 'IT Room',
    building: 'Building A',
    floor: '',
    room: '302',
    department: '',
    description: '',
    is_active: undefined,
  })

  assert.equal(result.success, true)
  if (result.success) {
    assert.equal(result.data.floor, null)
    assert.equal(result.data.department, null)
    assert.equal(result.data.is_active, false)
  }
})

test('unitSchema rejects a missing unit name', () => {
  const result = unitSchema.safeParse({
    name: '',
    is_active: 'on',
  })

  assert.equal(result.success, false)
  if (!result.success) {
    assert.ok(result.error.flatten().fieldErrors.name?.length)
  }
})

test('categorySchema rejects zero-width space names and accepts complex emojis within limit', () => {
  const zwspResult = categorySchema.safeParse({
    name: '\u200B',
    is_active: 'true',
  })
  assert.equal(zwspResult.success, false)

  // 12 family emojis (grapheme length: 12, UTF-16 length: 132)
  // Should succeed since getGraphemeLength(12) <= 120
  const emojiResult = categorySchema.safeParse({
    name: '👨‍👩‍👧‍👦'.repeat(12),
    is_active: 'true',
  })
  assert.equal(emojiResult.success, true)
  
  // 121 family emojis (grapheme length: 121, UTF-16 length: 1331)
  // Should fail since getGraphemeLength(121) > 120
  const emojiFailResult = categorySchema.safeParse({
    name: '👨‍👩‍👧‍👦'.repeat(121),
    is_active: 'true',
  })
  assert.equal(emojiFailResult.success, false)
})

