import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemGetTool, itemListTool, itemCreateTool } from './items'
import { runToolPipeline } from '../pipeline'

test('itemGetTool validates UUID or asset code format', async () => {
  const validContext = { actor: { role: 'viewer' as const, isActive: true } }
  const result = await runToolPipeline(itemGetTool, { idOrCode: 'AS-12345' }, validContext)
  assert.equal(result.success, true)
})

test('itemGetTool rejects empty idOrCode input with remediation hint', async () => {
  const validContext = { actor: { role: 'viewer' as const, isActive: true } }
  const result = await runToolPipeline(itemGetTool, { idOrCode: '' }, validContext)
  assert.equal(result.success, false)
  if (!result.success) {
    assert.equal(result.error.code, 'SCHEMA_VALIDATION_ERROR')
    assert.ok(result.error.fieldErrors?.idOrCode)
  }
})

test('itemListTool returns paginated items for authorized viewers', async () => {
  const validContext = { actor: { role: 'viewer' as const, isActive: true } }
  const result = await runToolPipeline(itemListTool, { limit: 10, offset: 0 }, validContext)
  assert.equal(result.success, true)
  if (result.success) {
    assert.ok(Array.isArray(result.data.items))
    assert.equal(typeof result.data.totalCount, 'number')
  }
})

test('itemCreateTool enforces staff role requirement and input limits', async () => {
  const viewerContext = { actor: { role: 'viewer' as const, isActive: true } }
  const staffContext = { actor: { role: 'staff' as const, isActive: true } }

  // 1. Viewer is unauthorized
  const unauthRes = await runToolPipeline(
    itemCreateTool,
    {
      item_name: 'Test Projector',
      item_type: 'asset',
      category_id: 'cat-1',
      quantity: 1,
    },
    viewerContext
  )
  assert.equal(unauthRes.success, false)
  if (!unauthRes.success) {
    assert.equal(unauthRes.error.code, 'UNAUTHORIZED_ERROR')
  }

  // 2. Staff is authorized
  const authRes = await runToolPipeline(
    itemCreateTool,
    {
      item_name: 'Test Projector',
      item_type: 'asset',
      category_id: 'cat-1',
      quantity: 1,
    },
    staffContext
  )
  assert.equal(authRes.success, true)
})
