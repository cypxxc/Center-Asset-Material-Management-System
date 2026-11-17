import '../../tests/setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ItemsList, type ItemsListProps } from '@/features/items/components/items-list-view'
import { Inspector } from '@/features/items/components/item-inspector-drawer'
import type { ItemListRow } from '@/features/items/types'

const item: ItemListRow = {
  id: 'material-1', item_name: 'กระดาษ A4', item_type: 'material', quantity: 0, unit_price: 122,
  asset_no: null, serial_no: null, responsible_person: null, status: 'active', updated_at: '',
  category: { id: 'category-1', name: 'วัสดุสำนักงาน' }, unit: { id: 'unit-1', name: 'รีม' }, location: null,
  material: { specification: '80 แกรม', commodity_code: '14111500', minimum_quantity: 2, maximum_quantity: 100,
    opening_quantity: 10, opening_amount: 1220, received_quantity: 5, received_amount: 610,
    issued_quantity: 15, issued_amount: 1830, balance_amount: 0, fiscal_year: 2570, balance_as_of: '2026-10-01' },
}

test('shared registry table renders material columns and supports inspection, selection, and sorting', () => {
  let inspected: ItemListRow | null = null
  let toggled = ''
  let sorted = ''
  const props: ItemsListProps = {
    items: [item], mode: 'material', startIndex: 50, selectedItemId: null, selectedItemIds: [],
    onSelect: value => { inspected = value }, onToggleSelectItem: id => { toggled = id },
    onToggleSelectAll: () => {}, allLoadedSelected: false, params: {},
    onToggleSort: field => { sorted = field }, userCanWrite: true,
  }
  try {
    render(React.createElement(ItemsList, props))
    assert.ok(screen.getByRole('columnheader', { name: 'รหัสวัสดุ' }))
    assert.equal(screen.queryByRole('columnheader', { name: 'เลขครุภัณฑ์' }), null)
    assert.equal(screen.queryByText('80 แกรม'), null)
    assert.ok(screen.getByText('14111500'))
    assert.ok(screen.getByText('0'))
    assert.ok(screen.getByText('51'))
    fireEvent.click(screen.getByText('กระดาษ A4'))
    assert.equal(inspected, item)
    inspected = null
    fireEvent.click(screen.getByRole('checkbox', { name: 'เลือก กระดาษ A4' }))
    assert.equal(toggled, item.id)
    assert.equal(inspected, null)
    fireEvent.click(screen.getByRole('button', { name: 'จัดเรียงตาม คงเหลือ' }))
    assert.equal(sorted, 'quantity')
  } finally { cleanup() }
})

test('shared inspector retains material specifications and original ledger details', () => {
  try {
    render(React.createElement(Inspector, { isOpen: true, mode: 'docked', onClose: () => {}, item }))
    assert.ok(screen.getByText('รายละเอียดวัสดุ'))
    assert.ok(screen.getByText('80 แกรม'))
    assert.ok(screen.getByText('14111500'))
    for (const label of ['จำนวนอย่างต่ำ', 'จำนวนอย่างสูง', 'ยอดยกมา — จำนวน', 'รับ — จำนวน', 'จ่าย — จำนวน', 'จำนวนเงินตามบัญชี (บาท)', 'วันที่ยอดตามบัญชี']) {
      assert.ok(screen.getByText(label))
    }
    assert.equal(screen.queryByText('สถานะเกณฑ์'), null)
  } finally { cleanup() }
})

test('asset ledger keeps its original columns when using the shared registry', () => {
  try {
    render(React.createElement(ItemsList, {
      items: [{ ...item, item_type: 'asset', material: undefined }], mode: 'ledger',
      selectedItemId: null, selectedItemIds: [], onSelect: () => {}, onToggleSelectItem: () => {},
      onToggleSelectAll: () => {}, allLoadedSelected: false, params: {}, onToggleSort: () => {},
    }))
    assert.ok(screen.getByRole('columnheader', { name: /รายการครุภัณฑ์/ }))
    assert.ok(screen.getByRole('columnheader', { name: /เลขครุภัณฑ์/ }))
    assert.equal(screen.queryByRole('columnheader', { name: 'รหัสวัสดุ' }), null)
  } finally { cleanup() }
})
