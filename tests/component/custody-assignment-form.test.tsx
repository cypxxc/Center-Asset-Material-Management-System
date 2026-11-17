import '../setup/dom'
import React from 'react'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { Dialog } from 'radix-ui'

globalThis.DocumentFragment = window.DocumentFragment
Object.assign(globalThis, { React, Element: window.Element, Node: window.Node })
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
globalThis.MutationObserver = window.MutationObserver
globalThis.NodeFilter = window.NodeFilter
globalThis.CustomEvent = window.CustomEvent
const actionsPath = require.resolve('../../features/disbursements/actions')
require.cache[actionsPath] = { id: actionsPath, filename: actionsPath, loaded: true, exports: { assignCustody: async () => ({ ok: true }) } } as NodeJS.Module
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CustodyAssignmentForm } = require('../../features/disbursements/components/custody-assignment-form') as typeof import('../../features/disbursements/components/custody-assignment-form')

test('central picker shows both types and keeps selections when filtering', () => {
  const view = render(<CustodyAssignmentForm items={[
    { id: 'asset-1', item_name: 'โต๊ะส่วนกลาง', item_type: 'asset', asset_no: 'A-001', serial_no: null, quantity: 1 },
    { id: 'material-1', item_name: 'กระดาษส่วนกลาง', item_type: 'material', asset_no: null, serial_no: null, quantity: 10 },
  ]} users={[]} onCancel={() => {}} onSuccess={() => {}} onPendingChange={() => {}} />)
  fireEvent.click(view.getByRole('button', { name: 'เลือกสิ่งของ' }))
  assert.equal(view.getAllByRole('checkbox').length, 2)
  fireEvent.click(view.getByRole('checkbox', { name: 'เลือก กระดาษส่วนกลาง' }))
  fireEvent.keyDown(view.getByRole('button', { name: 'ประเภทสิ่งของส่วนกลาง' }), { key: 'Enter' })
  fireEvent.click(view.getByRole('menuitemradio', { name: 'ครุภัณฑ์' }))
  assert.equal(view.queryByRole('checkbox', { name: 'เลือก กระดาษส่วนกลาง' }), null)
  fireEvent.click(view.getByRole('checkbox', { name: 'เลือก โต๊ะส่วนกลาง' }))
  fireEvent.click(view.getByRole('button', { name: 'ยืนยันรายการ (2)' }))
  const quantity = view.getByRole('spinbutton', { name: 'จำนวนที่จ่าย กระดาษส่วนกลาง' }) as HTMLInputElement
  assert.equal(quantity.max, '10')
  fireEvent.change(quantity, { target: { value: '3' } })
  assert.equal(quantity.value, '3')
  view.unmount()
})

test('expanded catalog cards preserve selected items after confirmation and reopening', () => {
  const view = render(<CustodyAssignmentForm items={[
    { id: 'asset-1', item_name: 'โต๊ะส่วนกลาง', item_type: 'asset', asset_no: 'A-001', serial_no: null, quantity: 1, location_name: 'ห้องประชุม', responsible_person: 'ผู้ถือครองเดิม' },
  ]} users={[]} onCancel={() => {}} onSuccess={() => {}} onPendingChange={() => {}} />)
  fireEvent.click(view.getByRole('button', { name: 'เลือกสิ่งของ' }))
  const checkbox = view.getByRole('checkbox', { name: 'เลือก โต๊ะส่วนกลาง' }) as HTMLInputElement
  assert.equal(checkbox.checked, false)
  fireEvent.click(checkbox)
  assert.equal(checkbox.checked, true)
  fireEvent.click(view.getByRole('button', { name: 'ยืนยันรายการ (1)' }))
  assert.equal(view.queryByRole('checkbox'), null)
  assert.ok(view.getByText('โต๊ะส่วนกลาง'))
  fireEvent.click(view.getByRole('button', { name: 'เลือกสิ่งของ' }))
  assert.equal((view.getByRole('checkbox', { name: 'เลือก โต๊ะส่วนกลาง' }) as HTMLInputElement).checked, true)
  view.unmount()
})

test('confirming or dismissing the left picker keeps the main modal open', async () => {
  let mainClosed = false
  const view = render(<Dialog.Root defaultOpen onOpenChange={(open) => { mainClosed = !open }}>
    <Dialog.Portal><Dialog.Content aria-describedby={undefined}>
      <Dialog.Title>มอบหมายผู้ถือครอง</Dialog.Title>
      <CustodyAssignmentForm items={[{ id: 'asset-1', item_name: 'โต๊ะส่วนกลาง', item_type: 'asset', asset_no: 'A-001', serial_no: null, quantity: 1 }]} users={[]} onCancel={() => {}} onSuccess={() => {}} onPendingChange={() => {}} />
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>)
  fireEvent.click(view.getByRole('button', { name: 'เลือกสิ่งของ' }))
  fireEvent.click(view.getByRole('checkbox', { name: 'เลือก โต๊ะส่วนกลาง' }))
  fireEvent.click(view.getByRole('button', { name: 'ยืนยันรายการ (1)' }))
  assert.ok(view.getByRole('dialog', { name: 'มอบหมายผู้ถือครอง' }))
  assert.equal(view.queryByRole('dialog', { name: 'เลือกสิ่งของส่วนกลาง' }), null)
  assert.equal(mainClosed, false)
  fireEvent.click(view.getByRole('button', { name: 'เลือกสิ่งของ' }))
  fireEvent.click(view.getByRole('checkbox', { name: 'เลือก โต๊ะส่วนกลาง' }))
  fireEvent.keyDown(view.getByRole('dialog', { name: 'เลือกสิ่งของส่วนกลาง' }), { key: 'Escape' })
  await waitFor(() => assert.equal(view.queryByRole('dialog', { name: 'เลือกสิ่งของส่วนกลาง' }), null))
  assert.equal(mainClosed, false)
  assert.ok(view.getByText('โต๊ะส่วนกลาง'))
  view.unmount()
})
