import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { BorrowCatalogView } from '../../features/disbursements/components/borrow-catalog-view'

test('catalog shows shopping cards with images and selectable items instead of a table', () => {
  const items = [{ id: 'asset-1', item_name: 'เครื่องฉายภาพ', item_type: 'asset' as const, asset_no: 'ASSET-001', serial_no: null, brand: 'Brand', model: null, quantity: 1, image_url: '/uploads/projector.jpg', category: null, unit_name: null, location_name: 'ห้องประชุม' }]
  const view = render(React.createElement(BorrowCatalogView, { items, searchQuery: '' }))
  assert.equal(view.container.querySelector('table') === null, true, 'catalog must use cards')
  assert.equal(view.getByAltText('เครื่องฉายภาพ').getAttribute('src'), '/uploads/projector.jpg')
  const select = view.getByRole('button', { name: 'เลือก เครื่องฉายภาพ' })
  fireEvent.click(select)
  assert.equal(select.getAttribute('aria-pressed'), 'true')
  assert.ok(view.getByRole('button', { name: 'สร้างคำขอรวม' }))
  view.rerender(React.createElement(BorrowCatalogView, { items, searchQuery: 'ไม่ตรงกับรายการ' }))
  assert.equal(view.container.querySelector('img'), null)
  assert.ok(view.getByText('ไม่พบพัสดุส่วนกลางที่พร้อมให้ยืม'))
})

test('catalog paginates cards in a footer and preserves selections across pages and search', () => {
  const items = Array.from({ length: 21 }, (_, index) => ({ id: `asset-${index}`, item_name: `สิ่งของ ${index + 1}`, item_type: 'asset' as const, asset_no: `ASSET-${index}`, serial_no: null, brand: null, model: null, quantity: 1, image_url: null, category: null, unit_name: null, location_name: null }))
  const view = render(React.createElement(BorrowCatalogView, { items, searchQuery: '' }))
  assert.ok(view.container.querySelector('footer'))
  assert.equal(view.getAllByRole('button', { name: /^เลือก สิ่งของ/ }).length, 20)
  fireEvent.click(view.getByRole('button', { name: 'เลือก สิ่งของ 1' }))
  fireEvent.click(view.getByRole('button', { name: 'หน้าถัดไป' }))
  assert.ok(view.getByText('แสดง 21–21 จาก 21 รายการ'))
  assert.ok(view.getByRole('button', { name: 'เลือก สิ่งของ 21' }))
  fireEvent.click(view.getByRole('button', { name: 'หน้าก่อนหน้า' }))
  assert.equal(view.getByRole('button', { name: 'เลือก สิ่งของ 1' }).getAttribute('aria-pressed'), 'true')
  fireEvent.click(view.getByRole('button', { name: 'หน้าถัดไป' }))
  view.rerender(React.createElement(BorrowCatalogView, { items, searchQuery: 'สิ่งของ 1' }))
  assert.equal(view.getByRole('button', { name: 'หน้า 1' }).getAttribute('aria-current'), 'page')
  assert.ok(view.getByRole('button', { name: 'สร้างคำขอรวม' }))
})
