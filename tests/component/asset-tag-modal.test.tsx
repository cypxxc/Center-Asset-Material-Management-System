import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { AssetTagModal } from '../../components/ui/asset-tag-modal'
import { calculateCustomGridDimensions, getTypographyForHeight } from '../../components/ui/asset-tag-layout'
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
  assert.ok(screen.getAllByText('ยี่ห้อ: Ergonomic').length >= 1)
  assert.ok(screen.getAllByText('สถานที่: ห้องทำงาน 302').length >= 1)

  // Verify barcode is not rendered and QR code is rendered
  assert.equal(screen.queryByRole('img', { name: 'บาร์โค้ด AST-2026-008' }), null)
  const qrSvgs = screen.getAllByRole('img', { name: /QR Code ลิงก์/ })
  assert.ok(qrSvgs.length >= 1)
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

  // Click Standard preset (10 per page)
  fireEvent.click(standardBtn)
  
  const pages = document.querySelectorAll('#printable-asset-tag .print-page-a4')
  assert.equal(pages.length, 1)

  const stickerBoxes = document.querySelectorAll('#printable-asset-tag .print-tag-card')
  assert.ok(stickerBoxes.length >= 1)
  const firstBox = stickerBoxes[0] as HTMLElement
  assert.equal(firstBox.style.width, '96mm')
  assert.equal(firstBox.style.height, 'auto')

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

  // Responsible person is default OFF
  assert.equal(screen.queryByText('ผู้รับผิดชอบ: สมชาย ใจดี'), null)

  // Toggle Responsible Person checkbox to ON
  const responsibleCheckbox = screen.getByLabelText('ผู้รับผิดชอบ')
  fireEvent.click(responsibleCheckbox)
  assert.ok(screen.getAllByText('ผู้รับผิดชอบ: สมชาย ใจดี').length >= 1)

  // Price is default OFF
  assert.equal(screen.queryByText(/ราคา: 15,500 บาท/), null)

  // Toggle Price checkbox to ON
  const priceCheckbox = screen.getByLabelText('ราคาซื้อ')
  fireEvent.click(priceCheckbox)
  assert.ok(screen.getAllByText(/ราคา: 15,500 บาท/).length >= 1)

  // Toggle Org Header to OFF
  const orgCheckbox = screen.getByLabelText('หัวเรื่อง CAMMS')
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
  assert.equal(screen.queryByRole('img', { name: 'บาร์โค้ด SN-MONITOR-99' }), null)
  const qrSvgs = screen.getAllByRole('img', { name: /QR Code ลิงก์ SN-MONITOR-99/ })
  assert.ok(qrSvgs.length >= 1)
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
  assert.ok(screen.getAllByText('สแกนตรวจสอบ').length >= 1)
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

  // Default margins (top:6, bottom:6, left:7, right:7) and gap (2.5):
  // width = (210 - 14 - 1 * 2.5) / 2 = 193.5 / 2 = 96.75 -> 96.8 mm
  // height = (297 - 12 - 5 * 2.5) / 6 = 272.5 / 6 = 45.41 -> 45.4 mm
  assert.ok(screen.getAllByText(/96.8 × 45.4 มม/).length >= 1)
  assert.ok(screen.getAllByText(/รวม 12 ดวง\/แผ่น/).length >= 1)

  // Verify printable asset tag updates with computed styles
  const pages = document.querySelectorAll('#printable-asset-tag .print-page-a4')
  assert.equal(pages.length, 1)

  const stickerBoxes = document.querySelectorAll('#printable-asset-tag .print-tag-card')
  const firstBox = stickerBoxes[0] as HTMLElement
  assert.equal(firstBox.style.width, '96.8mm')
  assert.equal(firstBox.style.height, 'auto')

  // Adjust margin and gap
  const gapInput = screen.getByRole('spinbutton', { name: 'ช่องกรอกระยะห่างระหว่างป้าย' })
  fireEvent.change(gapInput, { target: { value: '5' } })

  const topMarginInput = screen.getByRole('spinbutton', { name: 'ระยะขอบบน (mm)' })
  fireEvent.change(topMarginInput, { target: { value: '10' } })

  // width = (210 - 14 - 1 * 5) / 2 = 191 / 2 = 95.5 mm
  // height = (297 - 16 - 5 * 5) / 6 = 256 / 6 = 42.66 -> 42.7 mm
  assert.ok(screen.getAllByText(/95.5 × 42.7 มม/).length >= 1)
})

test('AssetTagModal toggles between Single View and A4 Sheet Preview', () => {
  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: mockItem,
    })
  )

  // Default is Standard preset (10 slots: 2 cols * 5 rows)
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

  // Standard preset has 10 slots (2 cols * 5 rows)
  const slots = sheetPreview.querySelectorAll('.grid > div')
  assert.equal(slots.length, 10)

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
  assert.equal(large.qrSize, 'h-14 w-14')
  assert.equal(large.nameSize, 'text-[11px] font-bold')

  const medium = getTypographyForHeight(38)
  assert.equal(medium.qrSize, 'h-12 w-12')
  assert.equal(medium.nameSize, 'text-[10px] font-bold')

  const small = getTypographyForHeight(28)
  assert.equal(small.qrSize, 'h-10 w-10')
  assert.equal(small.nameSize, 'text-[9.5px] font-bold')

  const compact = getTypographyForHeight(20)
  assert.equal(compact.qrSize, 'h-8 w-8')
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

  // Find Cut Lines checkbox (panel open by default)
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

test('AssetTagModal supports dynamic fields: adding renders immediately and removing leaves no placeholder', () => {
  const dynamicMockItem: ItemStickerData = {
    id: 'item-dyn-1',
    item_name: 'โต๊ะทำงานไฟฟ้า',
    asset_no: 'AST-DYN-001',
    brand: 'IKEA',
    model: 'BEKANT',
    category_name: 'ครุภัณฑ์สำนักงาน',
    location_name: 'ห้อง 501',
    received_date: '01/10/2026',
  }

  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: dynamicMockItem,
    })
  )

  // Primary fields are rendered by default
  assert.ok(screen.getAllByText('โต๊ะทำงานไฟฟ้า').length >= 1)
  assert.ok(screen.getAllByText('AST-DYN-001').length >= 1)
  assert.ok(screen.getAllByText('สถานที่: ห้อง 501').length >= 1)

  // Brand is ON by default, Model/Category/ReceivedDate are OFF
  assert.ok(screen.getAllByText('ยี่ห้อ: IKEA').length >= 1)
  assert.equal(screen.queryByText('รุ่น: BEKANT'), null)
  assert.equal(screen.queryByText('หมวดหมู่: ครุภัณฑ์สำนักงาน'), null)
  assert.equal(screen.queryByText('วันที่จัดซื้อ: 01/10/2026'), null)

  // Toggle Model ON -> renders immediately
  const modelCheckbox = screen.getByLabelText(/รุ่น/)
  fireEvent.click(modelCheckbox)
  assert.ok(screen.getAllByText('รุ่น: BEKANT').length >= 1)

  // Toggle Category ON -> renders immediately
  const categoryCheckbox = screen.getByLabelText(/หมวดหมู่/)
  fireEvent.click(categoryCheckbox)
  assert.ok(screen.getAllByText('หมวดหมู่: ครุภัณฑ์สำนักงาน').length >= 1)

  // Toggle Received Date ON -> renders immediately
  const dateCheckbox = screen.getByLabelText(/วันที่จัดซื้อ/)
  fireEvent.click(dateCheckbox)
  assert.ok(screen.getAllByText('วันที่จัดซื้อ: 01/10/2026').length >= 1)

  // Verify Preview label card uses auto height (content-driven, zero empty space)
  const previewCard = document.querySelector('.asset-tag-modal-overlay .print-tag-card') as HTMLElement
  assert.ok(previewCard)
  assert.equal(previewCard.style.height, 'auto')
  assert.ok(!previewCard.classList.contains('justify-between'))
  assert.ok(previewCard.classList.contains('justify-start'))

  // Toggle Brand OFF -> should remove brand entirely without leaving any placeholder
  const brandCheckbox = screen.getByLabelText(/ยี่ห้อ/)
  fireEvent.click(brandCheckbox)
  assert.equal(screen.queryByText('ยี่ห้อ: IKEA'), null)
  assert.ok(screen.getAllByText('รุ่น: BEKANT').length >= 1)
})

test('AssetTagModal correctly batches 25 items across A4 pages without stretching labels or inflating heights', () => {
  const mock25Items: ItemStickerData[] = Array.from({ length: 25 }, (_, idx) => ({
    id: `item-batch-${idx + 1}`,
    item_name: `ครุภัณฑ์ทดสอบ รายการที่ ${idx + 1}`,
    asset_no: `AST-2026-${String(idx + 1).padStart(3, '0')}`,
    brand: `Brand-${idx + 1}`,
    location_name: `ห้อง ${100 + idx}`,
  }))

  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      items: mock25Items,
    })
  )

  // 25 items with 10 per page -> exactly 3 pages
  const pages = document.querySelectorAll('#printable-asset-tag .print-page-a4')
  assert.equal(pages.length, 3)

  // Page 1: 10 items
  const page1Items = pages[0].querySelectorAll('.print-tag-card')
  assert.equal(page1Items.length, 10)

  // Page 2: 10 items
  const page2Items = pages[1].querySelectorAll('.print-tag-card')
  assert.equal(page2Items.length, 10)

  // Page 3: 5 items
  const page3Items = pages[2].querySelectorAll('.print-tag-card')
  assert.equal(page3Items.length, 5)

  // Every page container must use gridAutoRows: max-content, alignContent: start, alignItems: start
  pages.forEach((page) => {
    const pageEl = page as HTMLElement
    assert.equal(pageEl.style.gridAutoRows, 'max-content')
    assert.equal(pageEl.style.alignContent, 'start')
    assert.equal(pageEl.style.alignItems, 'start')
  })

  // Every sticker card across all pages must use width: 96mm, height: auto (NEVER height: 100%)
  const allStickers = document.querySelectorAll('#printable-asset-tag .print-tag-card')
  assert.equal(allStickers.length, 25)
  allStickers.forEach((stk) => {
    const el = stk as HTMLElement
    assert.equal(el.style.width, '96mm')
    assert.equal(el.style.height, 'auto')
    assert.notEqual(el.style.height, '100%')
    assert.ok(el.classList.contains('justify-start'))
    assert.ok(!el.classList.contains('justify-between'))
  })
})



