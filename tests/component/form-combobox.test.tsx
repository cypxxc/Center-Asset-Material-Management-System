import '../setup/dom'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fireEvent, render } from '@testing-library/react'
import { FormCombobox } from '../../components/ui/form-combobox'

Object.assign(globalThis, {
  Element: window.Element,
  Node: window.Node,
  DocumentFragment: window.DocumentFragment,
  getComputedStyle: window.getComputedStyle.bind(window),
  MutationObserver: window.MutationObserver,
  NodeFilter: window.NodeFilter,
  CustomEvent: window.CustomEvent,
})

test('searches Thai labels, selects by keyboard and submits the option ID', () => {
  const view = render(<form><label htmlFor="unit">หน่วยนับ</label><FormCombobox id="unit" name="unit_id" required>
    <option value="">ไม่ระบุ</option><option value="u1">เครื่อง</option><option value="u2">ชุด</option>
  </FormCombobox></form>)
  const input = view.getByRole('combobox', { name: 'หน่วยนับ' }) as HTMLInputElement
  assert.equal(input.checkValidity(), false)
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'เครื่' } })
  assert.equal(view.queryByRole('option', { name: 'ชุด' }), null)
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.keyDown(input, { key: 'Enter' })
  assert.equal(input.value, 'เครื่อง')
  assert.equal(input.checkValidity(), true)
  const form = view.container.querySelector('form')!
  assert.equal(new window.FormData(form).get('unit_id'), 'u1')
  view.unmount()
})

test('no results and Escape preserve the selected value; form reset restores default', () => {
  const view = render(<form><FormCombobox id="status" name="status" aria-label="สถานะ" defaultValue="active">
    <option value="active">ใช้งานได้</option><option value="damaged">ชำรุด</option>
  </FormCombobox></form>)
  const input = view.getByRole('combobox') as HTMLInputElement
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'ไม่ตรงกับรายการ' } })
  assert.ok(view.getByRole('status'))
  fireEvent.keyDown(input, { key: 'Escape' })
  assert.equal(input.value, 'ใช้งานได้')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'ชำรุด' } })
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.keyDown(input, { key: 'Enter' })
  assert.equal(input.value, 'ชำรุด')
  fireEvent.reset(view.container.querySelector('form')!)
  assert.equal(input.value, 'ใช้งานได้')
  view.unmount()
})

test('mapped reference options can be selected by mouse and cleared', () => {
  const view = render(<form><FormCombobox id="location" name="location_id">
    <option value="">ไม่ระบุ</option>
    {[{ id: 'l1', name: 'ห้องประชุม' }, { id: 'l2', name: 'สำนักงาน' }].map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
  </FormCombobox></form>)
  const input = view.getByRole('combobox') as HTMLInputElement
  fireEvent.focus(input)
  fireEvent.click(view.getByRole('option', { name: 'ห้องประชุม' }))
  assert.equal(new window.FormData(view.container.querySelector('form')!).get('location_id'), 'l1')
  fireEvent.focus(input)
  fireEvent.click(view.getByRole('option', { name: 'ไม่ระบุ' }))
  assert.equal(new window.FormData(view.container.querySelector('form')!).get('location_id'), '')
  view.unmount()
})

test('options stay inside the native dialog top layer', () => {
  const view = render(<dialog open><FormCombobox id="category" name="category_id" aria-label="หมวดหมู่">
    <option value="c1">สำนักงาน</option>
  </FormCombobox></dialog>)
  fireEvent.focus(view.getByRole('combobox'))
  const list = view.getByRole('listbox')
  assert.ok(view.container.querySelector('dialog')!.contains(list), 'dropdown must be inside the dialog; body portals appear behind a modal dialog')
  view.unmount()
})
