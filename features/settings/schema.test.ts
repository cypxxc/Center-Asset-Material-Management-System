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

test('categorySchema validates and normalizes 6-digit hex color', () => {
  // 1. Valid lowercase hex converted to uppercase
  const validResult = categorySchema.safeParse({
    name: 'อุปกรณ์ไอที',
    color: '#3b82f6',
    is_active: 'true',
  })
  assert.equal(validResult.success, true)
  if (validResult.success) {
    assert.equal(validResult.data.color, '#3B82F6')
  }

  // 2. Empty string from FormData defaults to #64748B
  const emptyResult = categorySchema.safeParse({
    name: 'อุปกรณ์ไอที',
    color: '',
    is_active: 'true',
  })
  assert.equal(emptyResult.success, true)
  if (emptyResult.success) {
    assert.equal(emptyResult.data.color, '#64748B')
  }

  // 3. Rejects 3-digit hex (#FFF)
  const threeDigitResult = categorySchema.safeParse({
    name: 'อุปกรณ์ไอที',
    color: '#FFF',
    is_active: 'true',
  })
  assert.equal(threeDigitResult.success, false)

  // 4. Rejects invalid hex characters (#GGGGGG)
  const invalidHexResult = categorySchema.safeParse({
    name: 'อุปกรณ์ไอที',
    color: '#GGGGGG',
    is_active: 'true',
  })
  assert.equal(invalidHexResult.success, false)
})

test('categorySchema validates and defaults icon safely', () => {
  // 1. Accepts valid whitelisted icon
  const validIcon = categorySchema.safeParse({
    name: 'คอมพิวเตอร์',
    icon: 'Laptop',
    is_active: 'true',
  })
  assert.equal(validIcon.success, true)
  if (validIcon.success) {
    assert.equal(validIcon.data.icon, 'Laptop')
  }

  // 2. Defaults to 'Tag' when empty or omitted
  const emptyIcon = categorySchema.safeParse({
    name: 'หมวดหมู่ทั่วไป',
    icon: '',
    is_active: 'true',
  })
  assert.equal(emptyIcon.success, true)
  if (emptyIcon.success) {
    assert.equal(emptyIcon.data.icon, 'Tag')
  }

  // 3. Rejects invalid / non-whitelisted icon
  const invalidIcon = categorySchema.safeParse({
    name: 'หมวดหมู่อื่น',
    icon: 'NonExistentIconXYZ',
    is_active: 'true',
  })
  assert.equal(invalidIcon.success, false)
  if (!invalidIcon.success) {
    assert.ok(invalidIcon.error.flatten().fieldErrors.icon?.length)
  }
})


