import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { LocationsClient } from '../../app/(dashboard)/locations/locations-client'

const mockLocations = [
  { id: 'loc-1', name: 'ห้องประชุมใหญ่ 101' },
  { id: 'loc-2', name: 'ห้องแล็บชีวภาพ 202' },
]

const mockItems = [
  {
    id: 'item-1',
    name: 'โปรเจคเตอร์ 4K',
    serialNumber: 'AST-PRJ-01',
    type: 'asset',
    qty: 1,
    categoryName: 'โสตทัศน์',
    locationId: 'loc-1',
    locationName: 'ห้องประชุมใหญ่ 101',
    status: 'active',
  },
  {
    id: 'item-2',
    name: 'ชุดไมโครโฟนไร้สาย',
    serialNumber: 'AST-MIC-02',
    type: 'asset',
    qty: 2,
    categoryName: 'โสตทัศน์',
    locationId: 'loc-1',
    locationName: 'ห้องประชุมใหญ่ 101',
    status: 'active',
  },
  {
    id: 'item-3',
    name: 'ตู้แช่สารเคมี',
    serialNumber: 'AST-FRZ-01',
    type: 'asset',
    qty: 1,
    categoryName: 'วิทยาศาสตร์',
    locationId: 'loc-2',
    locationName: 'ห้องแล็บชีวภาพ 202',
    status: 'active',
  },
]

test('LocationsClient shows batch print button when location is selected and triggers modal', () => {
  render(
    React.createElement(LocationsClient, {
      locations: mockLocations as unknown as React.ComponentProps<typeof LocationsClient>['locations'],
      items: mockItems as unknown as React.ComponentProps<typeof LocationsClient>['items'],
    }),
  )

  // Verify batch print button appears for default selected location (ห้องประชุมใหญ่ 101 has 2 items)
  const batchPrintBtn = screen.getByRole('button', { name: /พิมพ์ป้ายทั้งสถานที่ \(2 ชิ้น\)/ })
  assert.ok(batchPrintBtn, 'Batch print button for location should be rendered')

  // Click batch print button
  fireEvent.click(batchPrintBtn)

  // Verify AssetTagModal opens with the location tags count
  assert.ok(screen.getByText(/พิมพ์ลาเบลติดครุภัณฑ์/))
})

