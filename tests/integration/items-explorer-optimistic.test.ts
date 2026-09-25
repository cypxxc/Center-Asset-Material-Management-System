import '../setup/dom'
import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen, fireEvent, waitFor, within, cleanup, configure, act } from '@testing-library/react'
import type { ItemListRow } from '../../features/items/types'
import type { ActionResponse } from '../../lib/actions-helper'

afterEach(() => {
  cleanup()
})

// Ensure NodeFilter / MutationObserver / getComputedStyle / confirm are available
Object.assign(globalThis, {
  NodeFilter: window.NodeFilter,
  MutationObserver: window.MutationObserver,
  getComputedStyle: window.getComputedStyle,
  CustomEvent: window.CustomEvent,
  confirm: () => true,
})

// Limit waitFor timeout to prevent OOM from infinite retry loops on unresolvable assertions
configure({ asyncUtilTimeout: 3000 })

// Disable live Supabase channel in test
process.env.NEXT_PUBLIC_SUPABASE_URL = ''
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''

import { ItemsExplorerClient } from '../../app/(dashboard)/items/items-explorer-client'
import { ToastProvider } from '../../components/ui/toast'

let mockBulkUpdateHandler: (ids: string[], updates: any) => Promise<ActionResponse> = async () => ({
  success: true,
  message: 'แก้ไขสำเร็จ 2 รายการ',
})

let mockBulkDeleteHandler: (ids: string[]) => Promise<ActionResponse> = async () => ({
  success: true,
  message: 'ลบเรียบร้อย',
})


const loc1 = '11111111-1111-4111-8111-111111111111'
const loc2 = '22222222-2222-4222-8222-222222222222'
const loc3 = '33333333-3333-4333-8333-333333333333'
const cat1 = '44444444-4444-4444-8444-444444444444'
const cat2 = '55555555-5555-4555-8555-555555555555'
const unit1 = '66666666-6666-4666-8666-666666666666'
const unit2 = '77777777-7777-4777-8777-777777777777'
const item1Id = '88888888-8888-4888-8888-888888888888'
const item2Id = '99999999-9999-4999-8999-999999999999'

const mockItems: ItemListRow[] = [
  {
    id: item1Id,
    item_name: 'โน้ตบุ๊ก Dell Latitude 5420',
    item_type: 'asset',
    category: { id: cat1, name: 'อุปกรณ์ไอที' },
    location: { id: loc1, name: 'ห้องทำงานชั้น 3' },
    unit: { id: unit1, name: 'เครื่อง' },
    quantity: 1,
    unit_price: 32000,
    asset_no: 'EQ-2026-001',
    serial_no: 'SN-DELL-998811',
    brand: 'Dell',
    model: 'Latitude 5420',
    responsible_person: 'นายสมชาย วิศวกรรม',
    status: 'active',
    note: 'สภาพดี',
    image_url: null,
    updated_at: '2026-01-02T00:00:00Z',
  },
  {
    id: item2Id,
    item_name: 'กระดาษ Double A A4 80gsm',
    item_type: 'material',
    category: { id: cat2, name: 'เครื่องเขียนและวัสดุสำนักงาน' },
    location: { id: loc2, name: 'ห้องเก็บของส่วนกลาง' },
    unit: { id: unit2, name: 'รีม' },
    quantity: 50,
    unit_price: 135,
    asset_no: null,
    serial_no: null,
    brand: 'Double A',
    model: '80gsm',
    responsible_person: null,
    status: 'spare',
    note: null,
    image_url: null,
    updated_at: '2026-01-06T00:00:00Z',
  },
]

const defaultProps = {
  items: mockItems,
  total: 2,
  nextCursor: null,
  userId: 'user-1',
  params: {},
  userCanWrite: true,
  userCanDelete: true,
  locations: [
    { id: loc1, name: 'ห้องทำงานชั้น 3' },
    { id: loc2, name: 'ห้องเก็บของส่วนกลาง' },
    { id: loc3, name: 'ห้องปฏิบัติการใหม่' },
  ],
  categories: [
    { id: cat1, name: 'อุปกรณ์ไอที' },
    { id: cat2, name: 'เครื่องเขียนและวัสดุสำนักงาน' },
  ],
  units: [
    { id: unit1, name: 'เครื่อง' },
    { id: unit2, name: 'รีม' },
  ],
}

function renderExplorer(props: Partial<React.ComponentProps<typeof ItemsExplorerClient>> = {}) {
  return render(
    React.createElement(
      ToastProvider,
      null,
      React.createElement(ItemsExplorerClient, {
        ...defaultProps,
        bulkUpdateAction: async (ids, updates) => mockBulkUpdateHandler(ids, updates),
        bulkHardDeleteAction: async (ids) => mockBulkDeleteHandler(ids),
        ...props,
      })
    )
  )
}

function getBulkEditDialog() {
  const dialogTitle = screen.getByText(/แก้ไขหลายรายการ \(2 รายการ\)|ยืนยันการแก้ไข/)
  return dialogTitle.closest('[role="dialog"]') as HTMLElement
}

test('Bulk Edit: optimistic update applies changes instantly and rolls back on server failure', async () => {
  let resolveServerAction!: (res: ActionResponse) => void
  const serverPromise = new Promise<ActionResponse>((resolve) => {
    resolveServerAction = resolve
  })

  mockBulkUpdateHandler = async () => serverPromise

  renderExplorer()

  // Select all loaded items
  fireEvent.click(screen.getByLabelText('เลือกทุกรายการที่โหลดอยู่'))
  assert.ok(screen.getByText('เลือกอยู่ 2 รายการ'))

  const item1Row = () => screen.getByText('โน้ตบุ๊ก Dell Latitude 5420').closest('tr')!
  const item2Row = () => screen.getByText('กระดาษ Double A A4 80gsm').closest('tr')!

  // Initial statuses
  assert.ok(within(item1Row()).getByText('ใช้งานอยู่'))
  assert.ok(within(item2Row()).getByText('สำรอง'))

  // Open Bulk Edit Dialog
  fireEvent.click(screen.getByText('แก้ไขหลายรายการ'))
  const dialog = getBulkEditDialog()
  assert.ok(dialog)

  // Configure status change to "damaged" (ชำรุด)
  fireEvent.click(within(dialog).getByLabelText('แก้ไขสถานะ'))
  fireEvent.change(within(dialog).getByLabelText('สถานะ'), { target: { value: 'damaged' } })

  // Also change location to "ห้องปฏิบัติการใหม่"
  fireEvent.click(within(dialog).getByLabelText('แก้ไขสถานที่จัดเก็บ'))
  fireEvent.change(within(dialog).getByLabelText('สถานที่จัดเก็บ'), { target: { value: loc3 } })

  // Proceed to review step
  fireEvent.click(within(dialog).getByText('ตรวจสอบก่อนบันทึก'))
  assert.ok(within(dialog).getByText('ยืนยันการแก้ไข (2 รายการ)'))

  // Submit changes
  fireEvent.click(within(dialog).getByText('ยืนยันแก้ไข 2 รายการ'))

  // 1. INSTANT OPTIMISTIC UPDATE:
  // Before server responds, table UI state must ALREADY reflect the optimistic patch:
  // Both items should now have status "ชำรุด"
  await waitFor(() => {
    assert.ok(within(item1Row()).getByText('ชำรุด'))
    assert.ok(within(item2Row()).getByText('ชำรุด'))
    assert.equal(within(item1Row()).queryByText('ใช้งานอยู่'), null)
    assert.equal(within(item2Row()).queryByText('สำรอง'), null)
  })

  // 2. SERVER FAILURE & ROLLBACK:
  // Resolve server action with failure
  resolveServerAction({ success: false, message: 'ฐานข้อมูลขัดข้อง กรุณาลองใหม่' })

  // Verify rollback:
  // State returns to original ("ใช้งานอยู่" and "สำรอง")
  await waitFor(() => {
    assert.ok(within(item1Row()).getByText('ใช้งานอยู่'))
    assert.ok(within(item2Row()).getByText('สำรอง'))
    assert.equal(within(item1Row()).queryByText('ชำรุด'), null)
    assert.equal(within(item2Row()).queryByText('ชำรุด'), null)
  })

  // Dialog stays open displaying the error
  assert.ok(within(dialog).getByText('ฐานข้อมูลขัดข้อง กรุณาลองใหม่'))
})

test('Bulk Edit: optimistic update persists and closes dialog on server success', async () => {
  mockBulkUpdateHandler = async () => ({
    success: true,
    message: 'แก้ไขสำเร็จ 2 จาก 2 รายการ',
  })

  renderExplorer()

  // Select all loaded items
  fireEvent.click(screen.getByLabelText('เลือกทุกรายการที่โหลดอยู่'))

  // Open Bulk Edit Dialog
  fireEvent.click(screen.getByText('แก้ไขหลายรายการ'))
  const dialog = getBulkEditDialog()
  assert.ok(dialog)

  // Edit responsible person
  fireEvent.click(within(dialog).getByLabelText('แก้ไขผู้รับผิดชอบ'))
  fireEvent.change(within(dialog).getByLabelText('ผู้รับผิดชอบ'), { target: { value: 'ทีมซ่อมบำรุง' } })

  fireEvent.click(within(dialog).getByText('ตรวจสอบก่อนบันทึก'))

  await waitFor(() => {
    assert.ok(within(dialog).getByText('ยืนยันแก้ไข 2 รายการ'))
  })

  fireEvent.click(within(dialog).getByText('ยืนยันแก้ไข 2 รายการ'))

  // Use act() to flush the async onSave promise + all cascading React state updates
  // (onSave → onSaved → setBulkEditOpen/setSelectedItemIds). Using waitFor() here causes
  // a MutationObserver infinite retry loop leading to OOM because each DOM mutation resets
  // the waitFor retry timer before all assertions can settle simultaneously.
  await act(async () => {})

  // After act(), all microtasks and React state updates are settled — assert synchronously.
  assert.equal(screen.queryByText(/ยืนยันการแก้ไข/), null, 'Dialog should close')
  assert.equal(document.getElementById('bulk-edit-trigger'), null, 'Selection bar should disappear')

  const item1Row = () => screen.getByText('โน้ตบุ๊ก Dell Latitude 5420').closest('tr')!
  const item2Row = () => screen.getByText('กระดาษ Double A A4 80gsm').closest('tr')!

  // Optimistic update persists on table (no rollback was triggered)
  assert.ok(within(item1Row()).getByText('ทีมซ่อมบำรุง'))
  assert.ok(within(item2Row()).getByText('ทีมซ่อมบำรุง'))
})

test('Bulk Edit: rolls back when server action throws an exception', async () => {
  mockBulkUpdateHandler = async () => {
    throw new Error('Network disconnection')
  }

  renderExplorer()

  fireEvent.click(screen.getByLabelText('เลือกทุกรายการที่โหลดอยู่'))
  fireEvent.click(screen.getByText('แก้ไขหลายรายการ'))
  const dialog = getBulkEditDialog()
  assert.ok(dialog)

  fireEvent.click(within(dialog).getByLabelText('แก้ไขสถานะ'))
  fireEvent.change(within(dialog).getByLabelText('สถานะ'), { target: { value: 'damaged' } })

  fireEvent.click(within(dialog).getByText('ตรวจสอบก่อนบันทึก'))

  await waitFor(() => {
    assert.ok(within(dialog).getByText('ยืนยันแก้ไข 2 รายการ'))
  })

  fireEvent.click(within(dialog).getByText('ยืนยันแก้ไข 2 รายการ'))

  const item1Row = () => screen.getByText('โน้ตบุ๊ก Dell Latitude 5420').closest('tr')!
  const item2Row = () => screen.getByText('กระดาษ Double A A4 80gsm').closest('tr')!

  // act() flushes the optimisticUpdate + immediate throw + rollback — two waves of state
  // updates in the same microtask chain. waitFor() causes OOM here (same retry-loop issue).
  await act(async () => {})

  // Verify rollback on rejected promise
  assert.ok(within(item1Row()).getByText('ใช้งานอยู่'))
  assert.ok(within(item2Row()).getByText('สำรอง'))
  assert.equal(within(item1Row()).queryByText('ชำรุด'), null)
  assert.equal(within(item2Row()).queryByText('ชำรุด'), null)

  // Dialog displays connection error
  assert.ok(within(dialog).getByText('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่'))
})

  test('Bulk Delete: removes items instantly and rolls back on server failure', async () => {
    let resolveServerAction!: (res: ActionResponse) => void
    const serverPromise = new Promise<ActionResponse>((resolve) => {
      resolveServerAction = resolve
    })

    mockBulkDeleteHandler = async () => serverPromise

    renderExplorer()

    // Select Item 1 ('โน้ตบุ๊ก Dell Latitude 5420')
    const item1Checkbox = screen.getByLabelText('เลือก โน้ตบุ๊ก Dell Latitude 5420')
    fireEvent.click(item1Checkbox)
    assert.ok(screen.getByText('เลือกอยู่ 1 รายการ'))

    // Click Delete All — triggers optimisticDelete synchronously inside the onClick handler,
    // then fires the async server action. act() flushes all synchronous and microtask-queued
    // state updates from the click handler in one go (including optimisticDelete setState).
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ลบทั้งหมด' }))
    })

    // 1. INSTANT OPTIMISTIC DELETE:
    // After act(), all synchronous state updates from the click (optimisticDelete + setSelectedItemIds([]))
    // are committed. The item should already be gone from DOM.
    assert.equal(screen.queryByText('โน้ตบุ๊ก Dell Latitude 5420'), null, 'Item 1 should be immediately removed from UI')
    assert.ok(screen.getByText('กระดาษ Double A A4 80gsm'), 'Item 2 should still be present')
    assert.equal(screen.queryByText('เลือกอยู่ 1 รายการ'), null, 'Selection toolbar should be cleared')

    // 2. SERVER FAILURE & ROLLBACK:
    // Resolve the server promise with failure then flush all resulting state updates via act().
    // Using waitFor() here causes OOM (MutationObserver retry-loop); act() is safe.
    await act(async () => {
      resolveServerAction({ success: false, message: 'ไม่สามารถลบรายการได้ มีเอกสารอ้างอิง' })
      // Yield to let the awaited serverPromise resolve and React state updates cascade.
      await Promise.resolve()
    })

    // Verify rollback: item and selection are restored, blocking error modal is shown.
    assert.ok(screen.getByText('โน้ตบุ๊ก Dell Latitude 5420'), 'Item 1 should be restored in UI')
    assert.ok(screen.getByText('เลือกอยู่ 1 รายการ'), 'Selection should be restored on rollback')
    assert.ok(screen.getByText('ไม่สามารถลบรายการได้ มีเอกสารอ้างอิง'), 'Blocking error modal should be displayed')
  })

  test('Bulk Delete: removes items permanently and triggers toast on server success', async () => {
    mockBulkDeleteHandler = async () => ({
      success: true,
      message: 'ลบเรียบร้อยแล้ว 1 รายการ',
    })

    renderExplorer()

    const item1Checkbox = screen.getByLabelText('เลือก โน้ตบุ๊ก Dell Latitude 5420')
    fireEvent.click(item1Checkbox)

    const deleteBtn = screen.getByRole('button', { name: 'ลบทั้งหมด' })
    fireEvent.click(deleteBtn)

    // act() flushes optimisticDelete + server resolution + router.refresh in one go.
    // waitFor() on success paths causes OOM (MutationObserver retry-loop).
    await act(async () => {})

    // Item 1 is permanently removed
    assert.equal(screen.queryByText('โน้ตบุ๊ก Dell Latitude 5420'), null)
    assert.ok(screen.getByText('กระดาษ Double A A4 80gsm'))

    // Toast appears (triggerToast is synchronous after act)
    assert.ok(screen.getByText('ลบเรียบร้อยแล้ว 1 รายการ'))
  })

  test('Bulk Delete: rolls back and shows blocking error when server action throws', async () => {
    mockBulkDeleteHandler = async () => {
      throw new Error('Connection reset')
    }

    renderExplorer()

    const item1Checkbox = screen.getByLabelText('เลือก โน้ตบุ๊ก Dell Latitude 5420')
    fireEvent.click(item1Checkbox)

    const deleteBtn = screen.getByRole('button', { name: 'ลบทั้งหมด' })
    fireEvent.click(deleteBtn)

    // act() flushes optimisticDelete + immediate throw + rollback.
    await act(async () => {})

    // Verify rollback on network error
    assert.ok(screen.getByText('โน้ตบุ๊ก Dell Latitude 5420'), 'Item 1 restored on exception')
    assert.ok(screen.getByText('เลือกอยู่ 1 รายการ'), 'Selection restored')
    assert.ok(screen.getByText('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่'), 'Blocking error modal shown')
  })

