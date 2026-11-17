import assert from 'node:assert/strict'
import { test } from 'node:test'
import { centralItemUnavailableReason } from './catalog-availability'

test('central items remain visible with a reason when they cannot be selected', () => {
  assert.equal(centralItemUnavailableReason({ quantity: 1, status: 'active', reserved: true }), 'รออนุมัติ / กำลังยืม')
  assert.equal(centralItemUnavailableReason({ quantity: 1, status: 'damaged', reserved: false }), 'ชำรุด')
  assert.equal(centralItemUnavailableReason({ quantity: 0, status: 'active', reserved: false }), 'ไม่มีจำนวนคงเหลือ')
  assert.equal(centralItemUnavailableReason({ quantity: 1, status: 'disposed', reserved: false }), 'เสื่อมสภาพ')
  for (const status of ['active', 'spare', null]) {
    assert.equal(centralItemUnavailableReason({ quantity: 1, status, reserved: false }), null)
  }
})
