import '../../tests/setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react'

const calls: Record<string, unknown>[] = []
const returnCalls: Record<string, unknown>[] = []
let transportFailure = false
let ledgerVersion = 2
const stockActions = require.resolve('./stock-actions')
require.cache[stockActions] = { id: stockActions, filename: stockActions, loaded: true, exports: {
  loadMaterialStock: async () => ({ success: true, data: { quantity: 7, stock_version: ledgerVersion, opening_balance: '10', movements: '-3', reconciliation: { expected: 7, difference: 0, balanced: true }, history: [] } }),
  saveMaterialStock: async (input: Record<string, unknown>) => { calls.push(input); if (transportFailure) throw new Error('network response lost'); return { success: false, error: 'ไม่ได้รับการยืนยัน กรุณาลองซ้ำ' } },
  acceptMaterialReturn: async (input: Record<string, unknown>) => { returnCalls.push(input); if (transportFailure) throw new Error('network response lost'); return { success: false, error: 'กรุณาลองซ้ำ' } },
} } as NodeJS.Module

test('failed stock submission retains evidence, quantity and the same retry key', async () => {
  const oldForm = globalThis.FormData
  globalThis.FormData = window.FormData
  calls.length = 0
  transportFailure = false
  try {
    const { MaterialStockPanel } = await import('./material-stock-panel')
    const view = render(<MaterialStockPanel itemId="00000000-0000-4000-8000-000000000001" />)
    await waitFor(() => assert.equal((view.getByRole('button', { name: 'บันทึกการเคลื่อนไหว' }) as HTMLButtonElement).disabled, false))
    fireEvent.change(view.getByLabelText('จำนวนรับเข้า'), { target: { value: '3' } })
    fireEvent.change(view.getByLabelText('เหตุผล'), { target: { value: 'delivery' } })
    fireEvent.change(view.getByLabelText('เอกสารอ้างอิง'), { target: { value: 'RC-1' } })
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'บันทึกการเคลื่อนไหว' })))
    await waitFor(() => assert.ok(view.getByRole('alert')))
    assert.equal((view.getByLabelText('จำนวนรับเข้า') as HTMLInputElement).value, '3')
    assert.equal((view.getByLabelText('เอกสารอ้างอิง') as HTMLInputElement).value, 'RC-1')
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'บันทึกการเคลื่อนไหว' })))
    await waitFor(() => assert.equal(calls.length, 2))
    assert.equal(calls[0].request_key, calls[1].request_key)
  } finally { globalThis.FormData = oldForm }
})

test('ambiguous receipt response freezes editing and reload retries the original command without a count version', async () => {
  const oldForm = globalThis.FormData
  globalThis.FormData = window.FormData
  calls.length = 0; transportFailure = true; ledgerVersion = 2
  try {
    const { MaterialStockPanel } = await import('./material-stock-panel')
    const view = render(<MaterialStockPanel itemId="00000000-0000-4000-8000-000000000001" />)
    await waitFor(() => assert.equal((view.getByRole('button', { name: 'บันทึกการเคลื่อนไหว' }) as HTMLButtonElement).disabled, false))
    fireEvent.change(view.getByLabelText('จำนวนรับเข้า'), { target: { value: '3' } })
    fireEvent.change(view.getByLabelText('เหตุผล'), { target: { value: 'delivery' } })
    fireEvent.change(view.getByLabelText('เอกสารอ้างอิง'), { target: { value: 'RC-1' } })
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'บันทึกการเคลื่อนไหว' })))
    await waitFor(() => assert.ok(view.getByRole('alert')))
    assert.equal((view.getByLabelText('จำนวนรับเข้า').closest('fieldset') as HTMLFieldSetElement).disabled, true)
    ledgerVersion = 5
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'โหลดและตรวจนับใหม่' })))
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'ลองยืนยันรายการเดิมอีกครั้ง' })))
    await waitFor(() => assert.equal(calls.length, 2))
    assert.deepEqual(calls[1], calls[0])
    assert.equal(Object.hasOwn(calls[0], 'expected_stock_version'), false)
  } finally { transportFailure = false; globalThis.FormData = oldForm }
})

test('failed material return preserves inspected amounts and evidence for same-key retry', async () => {
  const oldForm = globalThis.FormData
  globalThis.FormData = window.FormData
  returnCalls.length = 0; transportFailure = false
  try {
    const { MaterialReturnForm } = await import('./material-return-form')
    const view = render(<MaterialReturnForm lineId="00000000-0000-4000-8000-000000000001" remaining={5} />)
    fireEvent.click(view.getByRole('button', { name: 'รับคืนวัสดุใช้ไม่หมด' }))
    fireEvent.change(view.getByLabelText('จำนวนส่งคืน'), { target: { value: '3' } })
    fireEvent.change(view.getByLabelText('จำนวนตรวจรับพร้อมใช้'), { target: { value: '2' } })
    fireEvent.change(view.getByLabelText('เหตุผล / ผลการตรวจ'), { target: { value: 'one damaged' } })
    fireEvent.change(view.getByLabelText('เอกสารรับคืนอ้างอิง'), { target: { value: 'RT-1' } })
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'ยืนยันตรวจรับคืน' })))
    await waitFor(() => assert.ok(view.getByRole('alert')))
    assert.equal((view.getByLabelText('จำนวนตรวจรับพร้อมใช้') as HTMLInputElement).value, '2')
    assert.equal((view.getByLabelText('เอกสารรับคืนอ้างอิง') as HTMLInputElement).value, 'RT-1')
    await act(async () => fireEvent.click(view.getByRole('button', { name: 'ยืนยันตรวจรับคืน' })))
    await waitFor(() => assert.equal(returnCalls.length, 2))
    assert.deepEqual(returnCalls[0], returnCalls[1])
  } finally { globalThis.FormData = oldForm }
})
