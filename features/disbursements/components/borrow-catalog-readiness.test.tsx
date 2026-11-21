import '../../../tests/setup/dom'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToastProvider } from '@/components/ui/toast'
import { BorrowCatalogView } from './borrow-catalog-view'
import type { CentralAvailableItem } from '../types'

// Use JSDOM's native implementation; the shared stub calls window.getSelection
// recursively when Radix moves focus between the dialog and a dropdown.
Object.defineProperty(document, 'getSelection', { configurable: true, value: window.Document.prototype.getSelection.bind(document) })

const item: CentralAvailableItem = {
  id: 'cart-readiness-item', item_name: 'เครื่องทดสอบ', asset_no: 'TEST-001',
  serial_no: null, brand: null, model: null, item_type: 'asset', quantity: 1,
  unit_name: 'เครื่อง', category: null, location_name: null, image_url: null,
  unavailable_reason: null,
}

test('catalog cannot add an item until its cart destination is mounted', () => {
  const view = render(<ToastProvider><BorrowCatalogView items={[item]} searchQuery="" /></ToastProvider>)
  assert.equal((screen.getByRole('button', { name: 'ใส่ เครื่องทดสอบ ลงในตะกร้า' }) as HTMLButtonElement).disabled, true)

  const cartContainer = document.createElement('div')
  document.body.append(cartContainer)
  try {
    view.rerender(<ToastProvider><BorrowCatalogView cartContainer={cartContainer} items={[item]} searchQuery="" /></ToastProvider>)
    assert.ok(screen.getByRole('button', { name: 'ตะกร้า (0)' }))
    assert.equal((screen.getByRole('button', { name: 'ใส่ เครื่องทดสอบ ลงในตะกร้า' }) as HTMLButtonElement).disabled, false)
  } finally {
    view.unmount()
    cartContainer.remove()
  }
})

test('material cart allows quantity entry and only issue requests', () => {
  Object.assign(globalThis, { MutationObserver: window.MutationObserver, CustomEvent: window.CustomEvent, NodeFilter: window.NodeFilter, Node: window.Node, Element: window.Element, getComputedStyle: window.getComputedStyle })
  const cartContainer = document.createElement('div')
  document.body.append(cartContainer)
  const material: CentralAvailableItem = { ...item, id: 'material-cart', item_type: 'material', item_name: 'กระดาษ A4', asset_no: null, quantity: 7, stock_quantity: 10, reserved_quantity: 3, available_quantity: 7, unit_name: 'รีม' }
  const view = render(<ToastProvider><BorrowCatalogView items={[material]} cartContainer={cartContainer} searchQuery="" /></ToastProvider>)
  try {
    assert.ok(screen.getByText('คงเหลือ 7 รีม'))
    fireEvent.click(screen.getByRole('button', { name: 'ใส่ กระดาษ A4 ลงในตะกร้า' }))
    fireEvent.click(screen.getByRole('button', { name: 'ตะกร้า (1)' }))
    const quantity = screen.getByRole('spinbutton', { name: 'จำนวนขอเบิก กระดาษ A4' }) as HTMLInputElement
    fireEvent.change(quantity, { target: { value: '3' } })
    assert.equal(quantity.value, '3')
    assert.equal(quantity.max, '7')
    assert.ok(screen.getByText('การทำรายการ: เบิกวัสดุ'))
    assert.equal(screen.queryByRole('button', { name: /การทำรายการ กระดาษ/ }), null)
  } finally { view.unmount(); cartContainer.remove() }
})

test('switching catalog types retains material quantities and accepts assets in the same cart', async () => {
  Object.assign(globalThis, { MutationObserver: window.MutationObserver, CustomEvent: window.CustomEvent, NodeFilter: window.NodeFilter, Node: window.Node, Element: window.Element, getComputedStyle: window.getComputedStyle })
  const cartContainer = document.createElement('div')
  document.body.append(cartContainer)
  const material: CentralAvailableItem = { ...item, id: 'mixed-material', item_type: 'material', item_name: 'กระดาษร่วมตะกร้า', quantity: 7, unit_name: 'รีม' }
  const items = [material, item]
  const view = render(<ToastProvider><BorrowCatalogView items={items} catalogType="material" cartContainer={cartContainer} searchQuery="" /></ToastProvider>)
  try {
    assert.equal(screen.queryByRole('button', { name: 'ใส่ เครื่องทดสอบ ลงในตะกร้า' }), null)
    fireEvent.click(screen.getByRole('button', { name: 'ใส่ กระดาษร่วมตะกร้า ลงในตะกร้า' }))
    fireEvent.click(screen.getByRole('button', { name: 'ตะกร้า (1)' }))
    fireEvent.change(screen.getByRole('spinbutton', { name: 'จำนวนขอเบิก กระดาษร่วมตะกร้า' }), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'ปิดตะกร้า' }))
    view.rerender(<ToastProvider><BorrowCatalogView items={items} catalogType="asset" cartContainer={cartContainer} searchQuery="" /></ToastProvider>)
    assert.ok(screen.getByRole('button', { name: 'ตะกร้า (1)' }))
    fireEvent.click(screen.getByRole('button', { name: 'ใส่ เครื่องทดสอบ ลงในตะกร้า' }))
    fireEvent.click(screen.getByRole('button', { name: 'ตะกร้า (2)' }))
    assert.equal((screen.getByRole('spinbutton', { name: 'จำนวนขอเบิก กระดาษร่วมตะกร้า' }) as HTMLInputElement).value, '3')
    assert.match(screen.getByRole('button', { name: 'การทำรายการ เครื่องทดสอบ' }).textContent ?? '', /ยืม/)
    fireEvent.keyDown(screen.getByRole('button', { name: 'การทำรายการ เครื่องทดสอบ' }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'เบิก' }))
    assert.match(screen.getByRole('button', { name: 'การทำรายการ เครื่องทดสอบ' }).textContent ?? '', /เบิก/)
    assert.equal(screen.queryByLabelText(/กำหนดส่งคืนรายการที่ยืม/), null)
    assert.ok(screen.getByText(/ระบบจะแยกเอกสารให้เมื่อยืนยัน/))
    view.rerender(<ToastProvider><BorrowCatalogView items={[material]} catalogType="asset" cartContainer={cartContainer} searchQuery="" /></ToastProvider>)
    assert.ok(screen.getByText('รายการนี้ไม่พร้อมใช้งานแล้ว กรุณานำออกจากตะกร้า'))
    assert.ok(screen.getByRole('button', { name: 'ตะกร้า (2)' }))
    fireEvent.click(screen.getByRole('button', { name: 'นำ เครื่องทดสอบ ออกจากรายการ' }))
    assert.ok(screen.getByRole('button', { name: 'ตะกร้า (1)' }))
    assert.equal((screen.getByRole('spinbutton', { name: 'จำนวนขอเบิก กระดาษร่วมตะกร้า' }) as HTMLInputElement).value, '3')
  } finally { view.unmount(); cartContainer.remove() }
})
