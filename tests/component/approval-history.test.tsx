import '../setup/dom'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { DisbursementListClient } from '../../features/disbursements/components/disbursement-list-client'

const props = {
  initialItems: [], total: 40, currentPage: 1, pageSize: 20, totalPages: 2,
  currentQ: '', currentStatus: 'all', currentType: '', canCreate: true,
  userRole: 'admin', initialTab: 'history' as const,
}

test('approval history has completed status filters and keeps its scope when navigating', () => {
  const navigation = require.cache[require.resolve('next/navigation')]!.exports
  const originalRouter = navigation.useRouter
  const urls: string[] = []
  navigation.useRouter = () => ({ replace: (url: string) => urls.push(url), push() {}, refresh() {} })
  try {
    const view = render(<DisbursementListClient {...props} />)
    assert.equal(view.queryByRole('button', { name: 'อนุมัติ' }), null)
    const action = view.getByLabelText('กรองตามการทำรายการ') as HTMLSelectElement
    assert.equal(action.value, 'approval_history')
    assert.ok(view.getByText('ยังไม่มีประวัติการอนุมัติ'))
    const select = view.getByLabelText('กรองตามสถานะเอกสาร') as HTMLSelectElement
    assert.deepEqual(Array.from(select.options).map(option => option.value), ['', 'confirmed', 'cancelled', 'reversed', 'returned', 'rejected'])
    fireEvent.change(select, { target: { value: 'returned' } })
    assert.equal(new URL(urls.at(-1)!, 'http://localhost').searchParams.get('tab'), 'history')
    fireEvent.click(view.getByLabelText('หน้าถัดไป'))
    const next = new URL(urls.at(-1)!, 'http://localhost')
    assert.equal(next.pathname, '/admin/audit-logs')
    assert.equal(next.searchParams.get('tab'), 'history')
    assert.equal(next.searchParams.get('page'), '2')
  } finally { cleanup(); navigation.useRouter = originalRouter }
})

test('approval history tab is removed from the disbursement workspace', () => {
  const view = render(<DisbursementListClient {...props} initialTab="requests" />)
  assert.equal(view.queryByRole('button', { name: 'ประวัติการอนุมัติ' }), null)
  assert.ok(view.getByRole('button', { name: 'อนุมัติ' }))
})

test('approval history is not offered to the user role', () => {
  const view = render(<DisbursementListClient {...props} userRole="user" initialTab="catalog" />)
  assert.equal(view.queryByRole('button', { name: 'ประวัติการอนุมัติ' }), null)
})
