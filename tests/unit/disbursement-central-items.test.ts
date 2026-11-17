import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertCentralDisbursementItem, isCentralDisbursementItem } from '../../features/disbursements/central-items'

test('central flag and legacy central marker allow issuing', () => {
  for (const item of [{ is_central: true }, { is_central: false, note: 'พัสดุส่วนกลาง' }]) {
    assert.equal(isCentralDisbursementItem(item), true)
    assert.doesNotThrow(() => assertCentralDisbursementItem(item))
  }
})

test('ordinary inventory cannot be issued through central disbursements', () => {
  for (const item of [{}, { is_central: false, note: null }, { note: 'ประจำห้อง' }]) {
    assert.equal(isCentralDisbursementItem(item), false)
    assert.throws(() => assertCentralDisbursementItem(item), /ส่วนกลาง/)
  }
})
