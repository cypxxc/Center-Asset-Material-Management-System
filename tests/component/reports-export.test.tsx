import '../setup/dom'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ReportsList } from '../../features/reports/components/reports-list'
import type { ReportItemRow } from '../../features/reports/queries'

// Export UI tests must not open real sockets when CI supplies Supabase settings.
// Realtime lifecycle behavior is covered separately in realtime-refresh.test.ts.
process.env.NEXT_PUBLIC_SUPABASE_URL = ''
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''

const item: ReportItemRow = {
  id: 'item-1', item_name: 'โต๊ะ', item_type: 'asset', quantity: 1,
  unit_price: 100, asset_no: null, serial_no: null, responsible_person: null,
  status: 'active', updated_at: '2026-09-09', category: null, unit: null,
  location: null, brand: null, model: null,
}

function showReport(totalCount = 5001) {
  return render(React.createElement(ReportsList, {
    items: [item], totalCount, totalQuantity: totalCount,
    totalValue: 100 * totalCount, totalPages: 101, currentPage: 1,
    searchParams: {}, categories: [], locations: [],
  }))
}

test('PDF over 5000 records shows an accessible Excel recommendation immediately', () => {
  showReport()
  fireEvent.click(screen.getByRole('button', { name: 'ส่งออกรายงาน PDF' }))
  assert.match(screen.getByRole('alert').textContent ?? '', /5,000.*Excel/)
})

test('Excel download failure is visible in the report', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'กรุณารอสักครู่' }, { status: 429 }))
  showReport(1)
  fireEvent.click(screen.getByRole('button', { name: 'ดาวน์โหลดรายงาน Excel' }))
  assert.equal((await screen.findByRole('alert')).textContent, 'กรุณารอสักครู่')
})
