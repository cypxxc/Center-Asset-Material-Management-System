import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { PublicItemView } from '../../app/(dashboard)/items/[id]/public-item-view'
import type { ItemDetail } from '../../features/items/types'

const mockItem: ItemDetail = {
  id: 'item-uuid-999',
  item_name: 'เครื่องคอมพิวเตอร์ประมวลผลสูง',
  item_type: 'asset',
  quantity: 1,
  unit_price: 45000,
  asset_no: 'AST-2026-999',
  serial_no: 'SN-CPU-888',
  brand: 'Dell',
  model: 'OptiPlex 7090',
  status: 'active',
  image_url: null,
  note: 'ใช้งานประจำห้องเซิร์ฟเวอร์',
  responsible_person: 'เจ้าหน้าที่ไอที',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  category: { id: 'cat-1', name: 'อุปกรณ์ไอที' },
  location: { id: 'loc-1', name: 'ห้องเซิร์ฟเวอร์ 1' },
  unit: { id: 'unit-1', name: 'เครื่อง' },
}

test('PublicItemView renders read-only asset card and staff login link', () => {
  render(React.createElement(PublicItemView, { item: mockItem }))

  // Title and branding
  assert.ok(screen.getByText('CAMMS — ระบบบริหารจัดการทรัพย์สิน'))
  assert.ok(screen.getByText('เครื่องคอมพิวเตอร์ประมวลผลสูง'))
  assert.ok(screen.getByText('AST-2026-999'))
  assert.ok(screen.getByText('SN-CPU-888'))
  assert.ok(screen.getByText('Dell / OptiPlex 7090'))
  assert.ok(screen.getByText('ห้องเซิร์ฟเวอร์ 1'))
  assert.ok(screen.getByText('เจ้าหน้าที่ไอที'))
  assert.ok(screen.getByText('ใช้งานประจำห้องเซิร์ฟเวอร์'))

  // Verify staff login button is rendered
  const loginLink = screen.getByRole('link', { name: /เข้าสู่ระบบเพื่อจัดการ/ })
  assert.ok(loginLink)
  assert.ok(loginLink.getAttribute('href')?.includes('/login?next=/items/item-uuid-999'))

  // Verify edit/delete controls are NOT present
  assert.equal(screen.queryByRole('button', { name: 'แก้ไข' }), null)
  assert.equal(screen.queryByRole('button', { name: 'ลบ' }), null)
})
