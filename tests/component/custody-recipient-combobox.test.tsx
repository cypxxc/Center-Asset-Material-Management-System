import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { Dialog } from 'radix-ui'
import { fireEvent, render } from '@testing-library/react'
import { CustodyRecipientCombobox } from '../../features/disbursements/components/custody-recipient-combobox'

Object.assign(globalThis, {
  getComputedStyle: window.getComputedStyle.bind(window),
  Node: window.Node,
  Element: window.Element,
  NodeFilter: window.NodeFilter,
  MutationObserver: window.MutationObserver,
  CustomEvent: window.CustomEvent,
})

const users = [{ id: 'one', full_name: 'สมชาย ใจดี' }, { id: 'two', full_name: 'สมหญิง รักงาน' }]

test('recipient search filters names, supports keyboard selection and reports no matches', () => {
  let selected = ''
  const view = render(React.createElement(CustodyRecipientCombobox, { users, value: '', onChange: value => { selected = value } }))
  const input = view.getByRole('combobox', { name: 'ผู้ถือครอง' })
  fireEvent.focus(input)
  assert.equal(view.container.contains(view.getByRole('listbox')), false, 'options must render outside the clipping modal container')
  assert.equal(view.getAllByRole('option').length, 2)
  fireEvent.change(input, { target: { value: 'หญิง' } })
  assert.equal(view.getAllByRole('option').length, 1)
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.keyDown(input, { key: 'Enter' })
  assert.equal(selected, 'two')
  assert.equal(input.getAttribute('aria-expanded'), 'false')
  fireEvent.change(input, { target: { value: 'ไม่พบชื่อ' } })
  assert.equal(selected, '', 'editing must clear the previous recipient')
  assert.ok(view.getByText('ไม่พบผู้ถือครอง'))
})

test('recipient can be selected with mouse and disabled during submission', () => {
  let selected = ''
  const view = render(React.createElement(CustodyRecipientCombobox, { users, value: '', onChange: value => { selected = value } }))
  fireEvent.focus(view.getByRole('combobox'))
  fireEvent.click(view.getByRole('option', { name: 'สมชาย ใจดี' }))
  assert.equal(selected, 'one')
  view.rerender(React.createElement(CustodyRecipientCombobox, { users, value: 'one', onChange: () => {}, disabled: true }))
  assert.equal((view.getByRole('combobox') as HTMLInputElement).disabled, true)
})

test('dropdown escapes a scrollable modal and Escape closes only the dropdown', () => {
  let selected = ''
  const view = render(<Dialog.Root defaultOpen>
    <Dialog.Portal><Dialog.Overlay />
      <Dialog.Content aria-describedby={undefined} style={{ overflow: 'hidden', maxHeight: 200 }}>
        <Dialog.Title>สั่งจ่าย</Dialog.Title>
        <div style={{ overflowY: 'auto' }}>
          <CustodyRecipientCombobox users={users} value="" onChange={value => { selected = value }} />
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>)
  const input = view.getByRole('combobox')
  fireEvent.focus(input)
  const modal = view.getByRole('dialog', { name: 'สั่งจ่าย' })
  assert.equal(modal.contains(view.getByRole('listbox')), false)
  fireEvent.keyDown(input, { key: 'Escape' })
  assert.equal(view.queryByRole('listbox'), null)
  assert.ok(view.getByRole('dialog', { name: 'สั่งจ่าย' }))
  fireEvent.click(input)
  fireEvent.mouseDown(view.getByRole('option', { name: 'สมหญิง รักงาน' }))
  fireEvent.click(view.getByRole('option', { name: 'สมหญิง รักงาน' }))
  assert.equal(selected, 'two')
  assert.ok(view.getByRole('dialog', { name: 'สั่งจ่าย' }))
})
