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
test('AssetTagModal renders title, item info, and QR without barcode when open', () => {
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

  // The printed label keeps the identifier but no longer renders a barcode.
  assert.equal(screen.queryByRole('img', { name: 'บาร์โค้ด AST-2026-008' }), null)
})

test('AssetTagModal supports standard and custom presets', () => {
  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: mockItem,
    })
  )

  // Verify 2 presets are listed
  const standardBtn = screen.getByRole('button', { name: /แบบมาตรฐาน/ })
  const customGridBtn = screen.getByRole('button', { name: /แบบกำหนดเอง/ })

  assert.ok(standardBtn)
  assert.ok(customGridBtn)

  // Click Standard preset (16 per page)
  fireEvent.click(standardBtn)
  
  const pages = document.querySelectorAll('#printable-asset-tag .print-page-a4')
  assert.equal(pages.length, 1)

  const stickerBoxes = document.querySelectorAll('#printable-asset-tag .print-tag-card')
  assert.ok(stickerBoxes.length >= 1)
  const firstBox = stickerBoxes[0] as HTMLElement
  assert.equal(firstBox.style.width, '100%')
  assert.equal(firstBox.style.height, '100%')

  // Click Custom Grid preset
  fireEvent.click(customGridBtn)
  const updatedPages = document.querySelectorAll('#printable-asset-tag .print-page-a4')
  assert.equal(updatedPages.length, 1)
})

test('AssetTagModal chunks expandedPrintList into multiple pages for A4 sheet', () => {
  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: mockItem,
    })
  )
  
  // Select Standard preset (10 per page)
  const standardBtn = screen.getByRole('button', { name: /แบบมาตรฐาน/ })
  fireEvent.click(standardBtn)
  
  // Set 11 copies -> should yield 2 pages
  const copyInput = screen.getByRole('spinbutton', { name: 'จำนวนสำเนาลาเบล' })
  fireEvent.change(copyInput, { target: { value: '11' } })
  
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
  assert.equal(screen.queryByText('CAMMS'), null)
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
  assert.equal(screen.queryByRole('img', { name: 'บาร์โค้ด SN-MONITOR-99' }), null)
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
  assert.ok(screen.getAllByText('สแกนดูรายละเอียด').length >= 1)
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
  const customGridBtn = screen.getByRole('button', { name: /แบบกำหนดเอง/ })
  fireEvent.click(customGridBtn)

  // Verify custom grid settings control panel is visible
  assert.ok(screen.getByText('ตั้งค่าตาราง Grid (คอลัมน์ × แถว บน A4)'))
  assert.ok(screen.getByText(/ขนาดต่อดวง:/))

  // Find column number input and row number input
  const colInput = screen.getByRole('spinbutton', { name: 'ช่องกรอกจำนวนคอลัมน์' })
  const rowInput = screen.getByRole('spinbutton', { name: 'ช่องกรอกจำนวนแถว' })

  // Adjust columns to 2 and rows to 6
  fireEvent.change(colInput, { target: { value: '2' } })
  fireEvent.change(rowInput, { target: { value: '6' } })

  // Default margins (top:8, bottom:8, left:6, right:6) and gap (3):
  // width = (210 - 12 - 1 * 3) / 2 = 195 / 2 = 97.5 mm
  // height = (297 - 16 - 5 * 3) / 6 = 266 / 6 = 44.33 -> 44.3 mm
  assert.ok(screen.getAllByText(/97.5 × 44.3 มม/).length >= 1)
  assert.ok(screen.getAllByText(/รวม 12 ดวง\/แผ่น/).length >= 1)

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

  // width = (210 - 12 - 1 * 5) / 2 = 193 / 2 = 96.5 mm
  // height = (297 - 18 - 5 * 5) / 6 = 254 / 6 = 42.33 -> 42.3 mm
  assert.ok(screen.getAllByText(/96.5 × 42.3 มม/).length >= 1)
})

test('AssetTagModal toggles between Single View and A4 Sheet Preview', () => {
  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: mockItem,
    })
  )

  // Default is Standard preset (16 slots: 2 cols * 8 rows)
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

  // Preview uses exactly the same sheet and QR markup as printing.
  const previewSheet = sheetPreview.querySelector('.print-page-a4')
  const printedSheet = document.querySelector('#printable-asset-tag .print-page-a4')
  assert.ok(previewSheet)
  assert.ok(printedSheet)
  assert.equal(previewSheet.outerHTML, printedSheet.outerHTML)
  assert.equal(previewSheet.querySelectorAll('.label-card').length, 1)
  assert.ok(previewSheet.querySelector('svg[aria-label^="QR Code"]'))
  assert.ok(!previewSheet.textContent?.includes('ว่าง'))

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
  assert.equal(large.nameSize, 'text-xs font-bold')

  const medium = getTypographyForHeight(38)
  assert.equal(medium.nameSize, 'text-[10.5px] font-bold')

  const small = getTypographyForHeight(28)
  assert.equal(small.nameSize, 'text-[9.5px] font-bold')

  const compact = getTypographyForHeight(20)
  assert.equal(compact.nameSize, 'text-[8.5px] font-bold')
})

test('AssetTagModal renders dashed cut guide lines by default and supports toggling off', () => {
  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: mockItem,
    })
  )

  // Verify printable tags have dashed cut guide class by default
  const printableCard = document.querySelector('#printable-asset-tag .print-tag-card') as HTMLElement
  assert.ok(printableCard)
  assert.ok(printableCard.classList.contains('cut-guide-dashed'))
  assert.ok(printableCard.classList.contains('border-dashed'))

  // Open customize fields panel
  const customizeBtn = screen.getByRole('button', { name: /ปรับแต่งฟิลด์/ })
  fireEvent.click(customizeBtn)

  // Find Cut Lines checkbox
  const cutLinesCheckbox = screen.getByLabelText(/เส้นประสำหรับตัด/)
  assert.ok(cutLinesCheckbox)
  assert.equal((cutLinesCheckbox as HTMLInputElement).checked, true)

  // Toggle Cut Lines checkbox to OFF
  fireEvent.click(cutLinesCheckbox)
  assert.equal((cutLinesCheckbox as HTMLInputElement).checked, false)

  // Printable tag should now have solid border class
  assert.ok(printableCard.classList.contains('cut-guide-solid'))
  assert.ok(!printableCard.classList.contains('cut-guide-dashed'))
})


