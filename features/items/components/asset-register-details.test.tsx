import '../../../tests/setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, screen } from '@testing-library/react'
import { AssetRegisterDetails } from './asset-register-details'
import { ItemForm } from './item-form'

test('details show signed recorded amounts, zero book value and original register identity', () => {
  render(<AssetRegisterDetails item={{ register_sequence: '001', asset_prefix: 'สขส 7.', register_accumulated_depreciation: -13999, register_book_value: 0 }} />)
  assert.ok(screen.getByText('001'))
  assert.ok(screen.getByText('สขส 7.'))
  assert.ok(screen.getByText('-13,999.00 บาท'))
  assert.ok(screen.getByText('0.00 บาท'))
  assert.ok(screen.getByText('ไม่ระบุ'))
})

test('asset form submits register values and permits a group as custodian', () => {
  const { container } = render(<ItemForm action={async () => ({ success: false })} categories={[]} locations={[]} units={[]} responsibleUsers={[]}
    item={{ id: 'test', item_name: 'โต๊ะ', item_type: 'asset', quantity: 1, unit_price: 14000, asset_no: '7110-001/58', serial_no: null,
      responsible_person: 'กลุ่มงานอำนวยการ', status: 'active', updated_at: '', created_at: '', category: null, unit: null, location: null,
      brand: null, model: null, note: null, image_url: null, register_sequence: '001', asset_prefix: 'สขส 7.', register_accumulated_depreciation: -13999, register_book_value: 0 }} />)
  const form = container.querySelector('form')!
  const data = new window.FormData(form)
  assert.equal(data.get('register_sequence'), '001')
  assert.equal(data.get('register_book_value'), '0')
  assert.equal(data.get('register_accumulated_depreciation'), '-13999')
  const custodian = screen.getByLabelText('ผู้รับผิดชอบ') as HTMLInputElement
  assert.equal(custodian.tagName, 'INPUT')
  assert.equal(custodian.value, 'กลุ่มงานอำนวยการ')
})
