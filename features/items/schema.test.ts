import assert from 'node:assert/strict'
import test from 'node:test'
import { itemFormSchema } from './schema'

test('itemFormSchema accepts a valid asset item payload', () => {
  const result = itemFormSchema.safeParse({
    item_name: 'Dell Latitude 5420',
    item_type: 'asset',
    category_id: '7dcf13f3-0ef4-4475-8f33-377911250c7a',
    quantity: '1',
    unit_id: '9b91c190-d262-4f1d-9ecb-a20e7fb37f0a',
    asset_no: 'AS-001',
    serial_no: 'SN-001',
    brand: 'Dell',
    model: 'Latitude 5420',
    location_id: 'b408b20d-a9fb-463a-bc9c-777f29bba0bb',
    responsible_person: 'Somchai',
    status: 'active',
    note: 'Ready to use',
    image_url: '',
  })

  assert.equal(result.success, true)
  if (result.success) {
    assert.equal(result.data.quantity, 1)
    assert.equal(result.data.image_url, null)
  }
})

test('itemFormSchema rejects missing item name and invalid quantity', () => {
  const result = itemFormSchema.safeParse({
    item_name: '',
    item_type: 'asset',
    quantity: '0',
    status: 'active',
  })

  assert.equal(result.success, false)
  if (!result.success) {
    const fields = result.error.flatten().fieldErrors
    assert.ok(fields.item_name?.length)
    assert.ok(fields.quantity?.length)
  }
})
