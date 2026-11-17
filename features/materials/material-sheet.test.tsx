import '../../tests/setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ItemDetail } from '@/features/items/types'

let calls: { id: string | null; values: Record<string, FormDataEntryValue> }[] = []
let error = ''

test('material forms offer only material categories even when shared references include asset names', async () => {
  const { MaterialForm } = await import('./material-form')
  const { container } = render(React.createElement(MaterialForm, { inline: true, references: {
    categories: [{id:'asset-category',name:'สำนักงาน',item_type:'asset'}, {id:'material-category',name:'สำนักงาน',item_type:'material'}],
    locations: [{id:'room',name:'ห้อง'}], units: [{id:'piece',name:'ชิ้น'}],
  } }))
  const category = container.querySelector('select[name=category_id]') as HTMLSelectElement
  assert.deepEqual(Array.from(category.options, option=>option.value), ['', 'material-category'])
  assert.equal(container.querySelector('select[name=location_id] option[value=room]')?.textContent, 'ห้อง')
})
const stockActions = require.resolve('./stock-actions')
require.cache[stockActions] = { id: stockActions, filename: stockActions, loaded: true, exports: {
  loadMaterialStock: async () => ({ success: true, data: { quantity: 0, stock_version: 1, opening_balance: '0', movements: '0', reconciliation: { expected: 0, difference: 0, balanced: true }, history: [] } }),
  saveMaterialStock: async () => ({ success: false, error: 'unused fixture' }),
} } as NodeJS.Module
const filename = require.resolve('./actions')
require.cache[filename] = { id: filename, filename, loaded: true, exports: {
  saveMaterial: async () => { throw new Error('Full-page action must not be called') },
  saveMaterialInline: async (id: string | null, _state: unknown, form: FormData) => {
    calls.push({ id, values: Object.fromEntries(form) })
    return error ? { error } : { success: true, itemId: id ?? 'created-material' }
  },
} } as NodeJS.Module

async function openSheet(item?: ItemDetail) {
  const { NewItemSheet } = await import('@/features/items/components/new-item-sheet')
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
  window.HTMLDialogElement.prototype.close = function () { this.open = false }
  calls = []; error = ''
  const success: boolean[] = []
  const view = render(React.createElement(NewItemSheet, {
    open: true, itemType: 'material', item, categories: [], locations: [], units: [],
    onClose: () => {}, onSuccess: keepOpen => { success.push(Boolean(keepOpen)) },
  }))
  return { ...view, success }
}

test('material registration uses the shared modal, isolated drafts, and save-and-another', async () => {
  const originalFormData = globalThis.FormData
  globalThis.FormData = window.FormData
  const assetKey = 'center-asset-material-management-system:new-item-draft'
  const materialKey = 'center-asset-material-management-system:new-material-draft'
  window.localStorage.clear()
  window.localStorage.setItem(assetKey, JSON.stringify({ item_name: 'Asset draft' }))
  window.localStorage.setItem(materialKey, JSON.stringify({ item_name: 'Material draft', commodity_code: '14111500', quantity: '0' }))
  try {
    const { container, success } = await openSheet()
    assert.ok(screen.getByRole('dialog', { name: 'ขึ้นทะเบียนวัสดุใหม่' }))
    assert.equal(screen.queryByRole('tablist'), null)
    assert.equal((container.querySelector('[name=item_name]') as HTMLInputElement).value, 'Material draft')
    fireEvent.change(screen.getByLabelText('ขนาดหรือลักษณะ'), { target: { value: '80 gsm' } })
    fireEvent.change(screen.getByLabelText('ยอดยกมา — จำนวน'), { target: { value: '4' } })
    const submit = screen.getByRole('button', { name: 'บันทึกและเพิ่มรายการถัดไป' }) as HTMLButtonElement
    assert.ok(submit.form === container.querySelector('form'))
    await act(async () => { fireEvent.click(submit) })
    await waitFor(() => assert.deepEqual(success, [true]))
    assert.equal(calls[0].id, null)
    assert.equal(calls[0].values.specification, '80 gsm')
    assert.equal(calls[0].values.quantity, '0')
    assert.equal(calls[0].values.opening_quantity, '4')
    assert.equal((container.querySelector('[name=item_name]') as HTMLInputElement).value, '')
    assert.equal((container.querySelector('[name=commodity_code]') as HTMLInputElement).value, '')
    assert.equal((container.querySelector('[name=opening_quantity]') as HTMLInputElement).value, '')
    assert.equal(JSON.parse(window.localStorage.getItem(assetKey)!).item_name, 'Asset draft')
  } finally { cleanup(); globalThis.FormData = originalFormData; window.localStorage.clear() }
})

test('material edit prepopulates ledger fields and keeps the dialog open after validation failure', async () => {
  const originalFormData = globalThis.FormData
  globalThis.FormData = window.FormData
  const item: ItemDetail = {
    id: 'material-edit', item_name: 'Paper', item_type: 'material', quantity: 0, unit_price: 122,
    asset_no: null, serial_no: null, responsible_person: null, status: 'active', updated_at: '', created_at: '', metadata_version: 7, stock_version: 3,
    category: null, unit: null, location: null, brand: null, model: null, image_url: null, note: 'Keep note',
    material: { commodity_code: '14111500', specification: '80 gsm', minimum_quantity: 0, maximum_quantity: null,
      opening_quantity: 10, opening_amount: 1220, received_quantity: null, received_amount: null,
      issued_quantity: null, issued_amount: null, balance_amount: 0, fiscal_year: 2570, balance_as_of: '2026-10-01' },
  }
  try {
    const { container, success } = await openSheet(item)
    assert.ok(screen.getByRole('dialog', { name: 'แก้ไขรายการวัสดุ' }))
    assert.equal((screen.getByLabelText('รหัสวัสดุ') as HTMLInputElement).value, '14111500')
    assert.equal((screen.getByLabelText('ยอดยกมา — จำนวน') as HTMLInputElement).value, '10')
    assert.equal(container.querySelector('form')?.querySelector('input[name=quantity]'), null, 'metadata edit never submits quantity')
    assert.equal(screen.queryByRole('button', { name: 'บันทึกและเพิ่มรายการถัดไป' }), null)
    error = 'กรุณาตรวจสอบข้อมูล'
    fireEvent.change(screen.getByLabelText('ขนาดหรือลักษณะ'), { target: { value: '100 gsm' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' })) })
    await waitFor(() => assert.ok(screen.getByRole('alert')))
    assert.equal(calls[0].id, item.id)
    assert.deepEqual(success, [])
    assert.equal((screen.getByLabelText('ขนาดหรือลักษณะ') as HTMLInputElement).value, '100 gsm')
    assert.equal(container.querySelector('dialog')?.open, true)
    error = ''
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' })) })
    await waitFor(() => assert.deepEqual(success, [false]))
    assert.equal(calls[1].values.commodity_code, '14111500')
    assert.equal(calls[1].values.metadata_version, '7')
  } finally { cleanup(); globalThis.FormData = originalFormData }
})
