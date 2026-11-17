import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BulkEditDialog } from '../../features/items/components/bulk-edit-dialog'

Object.assign(globalThis, { NodeFilter: window.NodeFilter, MutationObserver: window.MutationObserver, getComputedStyle: window.getComputedStyle, CustomEvent: window.CustomEvent })

const location = { id: '11111111-1111-4111-8111-111111111111', name: 'ห้อง A' }
test('500-item edit requires a summary and sends only selected fields', async () => {
  const patches: unknown[] = []
  render(<BulkEditDialog count={500} locations={[location]} categories={[]} units={[]} onClose={() => {}}
    onSave={async patch => { patches.push(patch); return { success: true, message: 'saved' } }} onSaved={() => {}} />)
  assert.equal((screen.getByText('ตรวจสอบก่อนบันทึก') as HTMLButtonElement).disabled, true)
  fireEvent.click(screen.getByLabelText('แก้ไขสถานที่จัดเก็บ'))
  fireEvent.change(screen.getByLabelText('สถานที่จัดเก็บ'), { target: { value: location.id } })
  fireEvent.click(screen.getByText('ตรวจสอบก่อนบันทึก'))
  assert.equal(patches.length, 0)
  assert.ok(screen.getByText('ห้อง A'))
  fireEvent.click(screen.getByText('ยืนยันแก้ไข 500 รายการ'))
  await waitFor(() => assert.deepEqual(patches, [{ location_id: location.id }]))
})
test('failed save keeps the dialog and entered changes for retry', async () => {
  render(<BulkEditDialog count={2} locations={[]} categories={[]} units={[]} onClose={() => {}}
    onSave={async () => { throw new Error('offline') }} onSaved={() => assert.fail('must not report success')} />)
  fireEvent.click(screen.getByLabelText('แก้ไขผู้รับผิดชอบ'))
  fireEvent.change(screen.getByLabelText('ผู้รับผิดชอบ'), { target: { value: 'ฝ่ายพัสดุ' } })
  fireEvent.click(screen.getByText('ตรวจสอบก่อนบันทึก'))
  fireEvent.click(screen.getByText('ยืนยันแก้ไข 2 รายการ'))
  await waitFor(() => assert.match(screen.getByRole('alert').textContent ?? '', /เชื่อมต่อไม่สำเร็จ/))
  assert.ok(screen.getByText('ฝ่ายพัสดุ'))
})
