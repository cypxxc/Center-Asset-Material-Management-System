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
