import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { AssetTagModal } from '../../components/ui/asset-tag-modal'

const mockItem = {
  item_name: 'เก้าอี้สำนักงานเพื่อสุขภาพ',
  asset_no: 'AST-2026-008',
  serial_no: 'SN-776655',
  brand: 'Ergonomic',
  model: 'Pro 2026',
  location_name: 'ห้องทำงาน 302',
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

test('AssetTagModal switches sticker size presets', () => {
  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: mockItem,
    })
  )

  const smallPresetBtn = screen.getByRole('button', { name: 'Small (50×25mm)' })
  const compactPresetBtn = screen.getByRole('button', { name: 'Compact (40×20mm)' })

  // Click small preset
  fireEvent.click(smallPresetBtn)
  const stickerBoxes = document.querySelectorAll('#printable-asset-tag > div')
  assert.ok(stickerBoxes.length >= 1)
  const firstBox = stickerBoxes[0] as HTMLElement
  assert.equal(firstBox.style.width, '50mm')
  assert.equal(firstBox.style.height, '25mm')

  // Click compact preset
  fireEvent.click(compactPresetBtn)
  assert.equal(firstBox.style.width, '40mm')
  assert.equal(firstBox.style.height, '20mm')
})

test('AssetTagModal falls back to serial_no when asset_no is missing', () => {
  const itemWithoutAssetNo = {
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

    const printBtn = screen.getByRole('button', { name: /พิมพ์สติกเกอร์/ })
    fireEvent.click(printBtn)
    assert.equal(printCalled, true)
  } finally {
    window.print = originalPrint
  }
})

test('AssetTagModal renders multiple items in batch mode', () => {
  const items = [
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
  const itemWithId = {
    ...mockItem,
    id: 'item-uuid-12345',
  }

  render(
    React.createElement(AssetTagModal, {
      isOpen: true,
      onClose: () => {},
      item: itemWithId,
    })
  )

  const qrSvgs = screen.getAllByRole('img', { name: /QR Code ลิงก์/ })
  assert.ok(qrSvgs.length >= 1)
  assert.ok(screen.getAllByText('มือถือสแกน').length >= 1)
})
