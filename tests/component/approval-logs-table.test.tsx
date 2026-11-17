import '../setup/dom'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanup, fireEvent, render } from '@testing-library/react'
import AuditLogsClient from '../../app/(dashboard)/admin/audit-logs/audit-logs-client'

test('approval history uses the Logs table and expands audit changes', () => {
  try {
    const view = render(<AuditLogsClient
      initialLogs={[{
        id: 'audit-1', user_id: 'admin-1', action: 'CONFIRM_DISBURSEMENT',
        target_table: 'disbursements', target_id: 'request-1',
        old_data: { status: 'pending_approval' },
        new_data: { status: 'confirmed', document_no: 'DIS-001' },
        created_at: '2026-11-15T00:00:00Z', actor_name: 'ผู้อนุมัติทดสอบ',
      }]}
      initialTotalCount={1}
      initialSearchParams={{ q: '', action: 'approval_history', target_table: 'all', page: 1, pageSize: 50 }}
    />)
    assert.ok(view.getByRole('columnheader', { name: 'การเปลี่ยนแปลง' }))
    assert.ok(view.getByRole('columnheader', { name: 'ผู้ทำรายการ' }))
    const row = view.getByText('อนุมัติเบิก–ยืม').closest('tr')!
    fireEvent.click(row)
    assert.ok(view.getAllByText('รออนุมัติ').length)
    assert.ok(view.getAllByText('DIS-001').length)
    fireEvent.click(row)
    assert.equal(view.queryByText('DIS-001'), null)
  } finally { cleanup() }
})
