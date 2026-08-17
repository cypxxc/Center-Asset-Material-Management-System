import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { AssetTagModal, PRESETS } from '../../components/ui/asset-tag-modal'
import type { ItemStickerData } from '../../components/ui/asset-tag-modal'

const mockItem: ItemStickerData = {
  id: 'item-uuid-123',
  item_name: 'เก้าอี้สำนักงานเพื่อสุขภาพ',
  asset_no: 'AST-2026-008',
  serial_no: 'SN-776655',
  brand: 'Ergonomic',
  model: 'Pro 2026',
  location_name: 'ห้องทำงาน 302',
  category_name: 'ครุภัณฑ์สำนักงาน',
  responsible_person: 'สมชาย ใจดี',
  unit_price: 15500,
}

test('AssetTagModal renders null when isOpen is false', () => {
  const { container } = render(
    React.createElement(AssetTagModal, {
      isOpen: false,
      onClose: () => {},
      item: mockItem,
    })
  )

  assert.equal(container.innerHTML, '')
})

test('AssetTagModal renders title, item info, and barcode when open', () => {
  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: mockItem,
    })
  )

  assert.ok(screen.getByText('พิมพ์ลาเบลติดครุภัณฑ์'))
  assert.ok(screen.getAllByText('เก้าอี้สำนักงานเพื่อสุขภาพ').length >= 1)
  assert.ok(screen.getAllByText('AST-2026-008').length >= 1)
  assert.ok(screen.getAllByText('Ergonomic Pro 2026').length >= 1)
  assert.ok(screen.getAllByText('สถานที่: ห้องทำงาน 302').length >= 1)

  // Verify barcode SVG is rendered
  const barcodeSvgs = screen.getAllByRole('img', { name: 'บาร์โค้ด AST-2026-008' })
  assert.ok(barcodeSvgs.length >= 1)
})

test('AssetTagModal supports A4 sheet presets and thermal presets', () => {
  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: mockItem,
    })
  )

  // Verify all 5 presets are listed
  const a4_3x8_Btn = screen.getByRole('button', { name: /A4 3×8/ })
  const a4_2x7_Btn = screen.getByRole('button', { name: /A4 2×7/ })
  const standardBtn = screen.getByRole('button', { name: /Standard \(70×35mm\)/ })
  const smallBtn = screen.getByRole('button', { name: /Small \(50×25mm\)/ })
  const compactBtn = screen.getByRole('button', { name: /Compact \(40×20mm\)/ })

  assert.ok(a4_3x8_Btn)
  assert.ok(a4_2x7_Btn)
  assert.ok(standardBtn)
  assert.ok(smallBtn)
  assert.ok(compactBtn)

  // Click A4 3x8 preset
  fireEvent.click(a4_3x8_Btn)
  const printableContainer = document.querySelector('#printable-asset-tag') as HTMLElement
  assert.ok(printableContainer.className.includes('print-sheet-grid'))

  const stickerBoxes = document.querySelectorAll('#printable-asset-tag > div')
  assert.ok(stickerBoxes.length >= 1)
  const firstBox = stickerBoxes[0] as HTMLElement
  assert.equal(firstBox.style.width, PRESETS.a4_3x8.width)
  assert.equal(firstBox.style.height, PRESETS.a4_3x8.height)

  // Click A4 2x7 preset
  fireEvent.click(a4_2x7_Btn)
  assert.equal(firstBox.style.width, PRESETS.a4_2x7.width)
  assert.equal(firstBox.style.height, PRESETS.a4_2x7.height)

  // Click small thermal preset
  fireEvent.click(smallBtn)
  assert.ok(printableContainer.className.includes('print-thermal-roll'))
  assert.equal(firstBox.style.width, '50mm')
  assert.equal(firstBox.style.height, '25mm')
})

test('AssetTagModal expands items according to copy multiplier', () => {
  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: mockItem,
    })
  )

  // Default is 1 copy
  let stickerBoxes = document.querySelectorAll('#printable-asset-tag > div')
  assert.equal(stickerBoxes.length, 1)

  // Increment copy count with + button
  const plusBtn = screen.getByRole('button', { name: 'เพิ่มจำนวนสำเนา' })
  fireEvent.click(plusBtn) // copy count = 2
  fireEvent.click(plusBtn) // copy count = 3

  stickerBoxes = document.querySelectorAll('#printable-asset-tag > div')
  assert.equal(stickerBoxes.length, 3)

  // Change input directly
  const copyInput = screen.getByRole('spinbutton', { name: 'จำนวนสำเนาลาเบล' })
  fireEvent.change(copyInput, { target: { value: '5' } })

  stickerBoxes = document.querySelectorAll('#printable-asset-tag > div')
  assert.equal(stickerBoxes.length, 5)
  assert.ok(screen.getAllByText(/5 ดวง/).length >= 1)
})

test('AssetTagModal toggles field visibility (price, responsible person, organization)', () => {
  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: mockItem,
    })
  )

  // Open field visibility customize panel
  const customizeBtn = screen.getByRole('button', { name: /ปรับแต่งฟิลด์/ })
  fireEvent.click(customizeBtn)

  // Responsible person is default OFF
  assert.equal(screen.queryByText('ผู้รับผิดชอบ: สมชาย ใจดี'), null)

  // Toggle Responsible Person checkbox to ON
  const responsibleCheckbox = screen.getByLabelText('ผู้รับผิดชอบ')
  fireEvent.click(responsibleCheckbox)
  assert.ok(screen.getAllByText('ผู้รับผิดชอบ: สมชาย ใจดี').length >= 1)

  // Price is default OFF
  assert.equal(screen.queryByText(/ราคา: 15,500 บาท/), null)

  // Toggle Price checkbox to ON
  const priceCheckbox = screen.getByLabelText('ราคาทรัพย์สิน')
  fireEvent.click(priceCheckbox)
  assert.ok(screen.getAllByText(/ราคา: 15,500 บาท/).length >= 1)

  // Toggle Org Header to OFF
  const orgCheckbox = screen.getByLabelText('ชื่อระบบ / CAMMS')
  fireEvent.click(orgCheckbox)
  assert.equal(screen.queryByText('CAMMS — ระบบบริหารจัดการทรัพย์สิน'), null)
})

test('AssetTagModal falls back to serial_no when asset_no is missing', () => {
  const itemWithoutAssetNo: ItemStickerData = {
    item_name: 'จอภาพ 27 นิ้ว',
    asset_no: null,
    serial_no: 'SN-MONITOR-99',
  }

  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: itemWithoutAssetNo,
    })
  )

  assert.ok(screen.getAllByText('SN-MONITOR-99').length >= 1)
  const barcodeSvgs = screen.getAllByRole('img', { name: 'บาร์โค้ด SN-MONITOR-99' })
  assert.ok(barcodeSvgs.length >= 1)
})

test('AssetTagModal triggers onClose callback when clicking close button or cancel button', () => {
  let closeCount = 0

  const { rerender } = render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {
        closeCount++
      },
      item: mockItem,
    })
  )

  const closeHeaderBtn = screen.getByRole('button', { name: 'ปิดหน้าต่าง' })
  fireEvent.click(closeHeaderBtn)
  assert.equal(closeCount, 1)

  rerender(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {
        closeCount++
      },
      item: mockItem,
    })
  )

  const cancelBtn = screen.getByRole('button', { name: 'ยกเลิก' })
  fireEvent.click(cancelBtn)
  assert.equal(closeCount, 2)
})

test('AssetTagModal calls window.print on print button click', () => {
  let printCalled = false
  const originalPrint = window.print
  window.print = () => {
    printCalled = true
  }

  try {
    render(
      React.createElement(AssetTagModal, {
        isOpen: true,
        onClose: () => {},
        item: mockItem,
      })
    )

    const printBtn = screen.getByRole('button', { name: /พิมพ์ลาเบล/ })
    fireEvent.click(printBtn)
    assert.equal(printCalled, true)
  } finally {
    window.print = originalPrint
  }
})

test('AssetTagModal renders multiple items in batch mode', () => {
  const items: ItemStickerData[] = [
    mockItem,
    {
      item_name: 'โน้ตบุ๊กทำงาน',
      asset_no: 'AST-2026-009',
      serial_no: 'SN-LAPTOP-123',
    },
  ]

  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      items: items,
    })
  )

  assert.ok(screen.getByText('พิมพ์ลาเบลติดครุภัณฑ์ (2 รายการ)'))
  assert.ok(screen.getByText('1 / 2'))

  const nextBtn = screen.getByRole('button', { name: 'รายการถัดไป' })
  fireEvent.click(nextBtn)

  assert.ok(screen.getByText('2 / 2'))
  assert.ok(screen.getAllByText('โน้ตบุ๊กทำงาน').length >= 1)
})

test('AssetTagModal renders Direct Link QR Code SVG element for mobile phone scanning', () => {
  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: mockItem,
    })
  )

  const qrSvgs = screen.getAllByRole('img', { name: /QR Code ลิงก์/ })
  assert.ok(qrSvgs.length >= 1)
  assert.ok(screen.getAllByText('มือถือสแกน').length >= 1)
})
