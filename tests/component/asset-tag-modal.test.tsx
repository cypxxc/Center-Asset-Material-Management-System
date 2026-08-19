import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { AssetTagModal, calculateCustomGridDimensions, getTypographyForHeight } from '../../components/ui/asset-tag-modal'
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

  // Verify all 6 presets are listed
  const a4_3x8_Btn = screen.getByRole('button', { name: /A4 3×8/ })
  const a4_2x7_Btn = screen.getByRole('button', { name: /A4 2×7/ })
  const customGridBtn = screen.getByRole('button', { name: /A4 กำหนดเอง/ })
  const standardBtn = screen.getByRole('button', { name: /Standard \(70×35mm\)/ })
  const smallBtn = screen.getByRole('button', { name: /Small \(50×25mm\)/ })
  const compactBtn = screen.getByRole('button', { name: /Compact \(40×20mm\)/ })

  assert.ok(a4_3x8_Btn)
  assert.ok(a4_2x7_Btn)
  assert.ok(customGridBtn)
  assert.ok(standardBtn)
  assert.ok(smallBtn)
  assert.ok(compactBtn)

  // Click A4 3x8 preset
  fireEvent.click(a4_3x8_Btn)
  
  const pages = document.querySelectorAll('#printable-asset-tag .print-page-a4')
  assert.equal(pages.length, 1)

  const stickerBoxes = document.querySelectorAll('#printable-asset-tag .print-tag-card')
  assert.ok(stickerBoxes.length >= 1)
  const firstBox = stickerBoxes[0] as HTMLElement
  assert.equal(firstBox.style.width, '100%')
  assert.equal(firstBox.style.height, '100%')

  // Click A4 2x7 preset
  fireEvent.click(a4_2x7_Btn)
  const updatedPages = document.querySelectorAll('#printable-asset-tag .print-page-a4')
  assert.equal(updatedPages.length, 1)
  
  // Click small thermal preset
  fireEvent.click(smallBtn)
  const printableContainer = document.querySelector('#printable-asset-tag') as HTMLElement
  assert.ok(printableContainer.querySelector('.print-thermal-roll'))
  const thermalBoxes = document.querySelectorAll('#printable-asset-tag .print-tag-card')
  assert.equal((thermalBoxes[0] as HTMLElement).style.width, '50mm')
  assert.equal((thermalBoxes[0] as HTMLElement).style.height, '25mm')
})

test('AssetTagModal chunks expandedPrintList into multiple pages for A4 sheet', () => {
  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: mockItem,
    })
  )
  
  // Select A4 3x8 preset (24 per page)
  const a4_3x8_Btn = screen.getByRole('button', { name: /A4 3×8/ })
  fireEvent.click(a4_3x8_Btn)
  
  // Set 25 copies
  const copyInput = screen.getByRole('spinbutton', { name: 'จำนวนสำเนาลาเบล' })
  fireEvent.change(copyInput, { target: { value: '25' } })
  
  // Should yield 2 .print-page-a4 elements
  const pages = document.querySelectorAll('#printable-asset-tag .print-page-a4')
  assert.equal(pages.length, 2)
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
  let stickerBoxes = document.querySelectorAll('#printable-asset-tag .print-tag-card')
  assert.equal(stickerBoxes.length, 1)

  // Increment copy count with + button
  const plusBtn = screen.getByRole('button', { name: 'เพิ่มจำนวนสำเนา' })
  fireEvent.click(plusBtn) // copy count = 2
  fireEvent.click(plusBtn) // copy count = 3

  stickerBoxes = document.querySelectorAll('#printable-asset-tag .print-tag-card')
  assert.equal(stickerBoxes.length, 3)

  // Change input directly
  const copyInput = screen.getByRole('spinbutton', { name: 'จำนวนสำเนาลาเบล' })
  fireEvent.change(copyInput, { target: { value: '5' } })

  stickerBoxes = document.querySelectorAll('#printable-asset-tag .print-tag-card')
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

test('AssetTagModal supports custom grid preset, column/row adjustments, and margin/gap settings', () => {
  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: mockItem,
    })
  )

  // Select custom grid preset
  const customGridBtn = screen.getByRole('button', { name: /A4 กำหนดเอง/ })
  fireEvent.click(customGridBtn)

  // Verify custom grid settings control panel is visible
  assert.ok(screen.getByText('ตั้งค่าตาราง Grid (คอลัมน์ × แถว บน A4)'))
  assert.ok(screen.getByText(/ขนาดป้ายต่อดวง:/))

  // Find column number input and row number input
  const colInput = screen.getByRole('spinbutton', { name: 'ช่องกรอกจำนวนคอลัมน์' })
  const rowInput = screen.getByRole('spinbutton', { name: 'ช่องกรอกจำนวนแถว' })

  // Adjust columns to 2 and rows to 6
  fireEvent.change(colInput, { target: { value: '2' } })
  fireEvent.change(rowInput, { target: { value: '6' } })

  // Default margins (top:5, bottom:5, left:5, right:5) and gap (2.5):
  // width = (210 - 10 - 1 * 2.5) / 2 = 197.5 / 2 = 98.75 -> 98.8 mm
  // height = (297 - 10 - 5 * 2.5) / 6 = 274.5 / 6 = 45.75 -> 45.8 mm
  assert.ok(screen.getAllByText(/98.8 × 45.8 mm/).length >= 1)
  assert.ok(screen.getAllByText(/รวม 12 ป้าย\/แผ่น/).length >= 1)

  // Verify printable asset tag updates with computed styles
  const pages = document.querySelectorAll('#printable-asset-tag .print-page-a4')
  assert.equal(pages.length, 1)

  const stickerBoxes = document.querySelectorAll('#printable-asset-tag .print-tag-card')
  const firstBox = stickerBoxes[0] as HTMLElement
  assert.equal(firstBox.style.width, '100%')
  assert.equal(firstBox.style.height, '100%')

  // Adjust margin and gap
  const gapInput = screen.getByRole('spinbutton', { name: 'ช่องกรอกระยะห่างระหว่างป้าย' })
  fireEvent.change(gapInput, { target: { value: '5' } })

  const topMarginInput = screen.getByRole('spinbutton', { name: 'ระยะขอบบน (mm)' })
  fireEvent.change(topMarginInput, { target: { value: '10' } })

  // width = (210 - 10 - 1 * 5) / 2 = 195 / 2 = 97.5 mm
  // height = (297 - 15 - 5 * 5) / 6 = 257 / 6 = 42.833 -> 42.8 mm
  assert.ok(screen.getAllByText(/97.5 × 42.8 mm/).length >= 1)
})

test('AssetTagModal toggles between Single View and A4 Sheet Preview', () => {
  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: mockItem,
    })
  )

  // Switch to an A4 Sheet preset (e.g. A4 3x8)
  const a4_3x8_Btn = screen.getByRole('button', { name: /A4 3×8/ })
  fireEvent.click(a4_3x8_Btn)

  // Verify Single vs Sheet preview toggle buttons exist
  const singleToggle = screen.getByRole('button', { name: 'ดูตัวอย่างแบบดวงเดี่ยว (Single)' })
  const sheetToggle = screen.getByRole('button', { name: 'ดูตัวอย่างทั้งแผ่น A4 (A4 Sheet Preview)' })
  assert.ok(singleToggle)
  assert.ok(sheetToggle)

  // Initially in single preview mode
  assert.equal(document.querySelector('[data-testid="a4-sheet-preview"]'), null)

  // Switch to A4 Sheet Preview
  fireEvent.click(sheetToggle)
  const sheetPreview = document.querySelector('[data-testid="a4-sheet-preview"]')
  assert.ok(sheetPreview)

  // A4 3x8 has 24 slots (3 cols * 8 rows)
  const slots = sheetPreview.querySelectorAll('.grid > div')
  assert.equal(slots.length, 24)

  // First slot should display mockItem name
  assert.ok(slots[0].textContent?.includes('เก้าอี้สำนักงานเพื่อสุขภาพ'))
  // Other unfilled slots should display "ว่าง"
  assert.ok(slots[1].textContent?.includes('ว่าง'))

  // Switch back to Single view
  fireEvent.click(singleToggle)
  assert.equal(document.querySelector('[data-testid="a4-sheet-preview"]'), null)
})

test('calculateCustomGridDimensions correctly calculates label dimensions', () => {
  const result1 = calculateCustomGridDimensions({
    cols: 3,
    rows: 8,
    marginTop: 5,
    marginBottom: 5,
    marginLeft: 5,
    marginRight: 5,
    gap: 2.5,
  })
  assert.equal(result1.width, 65.0)
  assert.equal(result1.height, 33.7)

  const result2 = calculateCustomGridDimensions({
    cols: 2,
    rows: 7,
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 10,
    marginRight: 10,
    gap: 0,
  })
  // width = (210 - 20) / 2 = 95.0
  // height = (297 - 20) / 7 = 39.57 -> 39.6
  assert.equal(result2.width, 95.0)
  assert.equal(result2.height, 39.6)
})

test('getTypographyForHeight returns scalable text styles and heights', () => {
  const large = getTypographyForHeight(50)
  assert.equal(large.barcodeHeight, 'h-7')
  assert.equal(large.nameSize, 'text-xs font-bold')

  const medium = getTypographyForHeight(38)
  assert.equal(medium.barcodeHeight, 'h-5')
  assert.equal(medium.nameSize, 'text-[10.5px] font-bold')

  const small = getTypographyForHeight(28)
  assert.equal(small.barcodeHeight, 'h-4.5')
  assert.equal(small.nameSize, 'text-[9.5px] font-bold')

  const compact = getTypographyForHeight(20)
  assert.equal(compact.barcodeHeight, 'h-3.5')
  assert.equal(compact.nameSize, 'text-[8.5px] font-bold')
})

