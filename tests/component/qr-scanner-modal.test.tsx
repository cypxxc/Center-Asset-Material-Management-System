import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QrScannerModal } from '../../components/ui/qr-scanner-modal'

test('QrScannerModal renders title, input fallback, and handles manual code submission', () => {
  let scannedResult: any = null
  let isClosed = false

  render(
    React.createElement(QrScannerModal, {
      isOpen: true,
      onClose: () => {
        isClosed = true
      },
      onScanSuccess: (result) => {
        scannedResult = result
      },
    }),
  )

  // Title and header
  assert.ok(screen.getByText('สแกน QR Code / บาร์โค้ดครุภัณฑ์'))

  // Manual input and scan button
  const input = screen.getByPlaceholderText(/พิมพ์รหัสครุภัณฑ์ หรือใช้เครื่องยิงบาร์โค้ด/)
  assert.ok(input)

  fireEvent.change(input, { target: { value: 'https://example.com/items/item-uuid-777' } })
  const submitButton = screen.getByRole('button', { name: /ค้นหา/ })
  fireEvent.click(submitButton)

  assert.ok(scannedResult)
  assert.equal(scannedResult.type, 'item_id')
  assert.equal(scannedResult.value, 'item-uuid-777')
})

test('QrScannerModal renders null when isOpen is false', () => {
  const { container } = render(
    React.createElement(QrScannerModal, {
      isOpen: false,
      onClose: () => {},
      onScanSuccess: () => {},
    }),
  )

  assert.equal(container.firstChild, null)
})
