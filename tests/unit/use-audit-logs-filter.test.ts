import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAuditLogsUrl } from '@/features/admin/hooks/use-audit-logs-filter'

test('buildAuditLogsUrl constructs correct URL search query', () => {
  const url = buildAuditLogsUrl('/admin/audit-logs', {
    q: 'item-123',
    action: 'UPDATE',
    target_table: 'items',
    page: 2,
    pageSize: 20,
  })

  assert.equal(
    url,
    '/admin/audit-logs?q=item-123&action=UPDATE&target_table=items&page=2&pageSize=20'
  )
})

test('buildAuditLogsUrl omits default values ("all", page 1, pageSize 50)', () => {
  const url = buildAuditLogsUrl('/admin/audit-logs', {
    q: '',
    action: 'all',
    target_table: 'all',
    page: 1,
    pageSize: 50,
  })

  assert.equal(url, '/admin/audit-logs')
})

test('buildAuditLogsUrl trims query string', () => {
  const url = buildAuditLogsUrl('/admin/audit-logs', {
    q: '  asset-01  ',
    action: 'all',
    target_table: 'all',
    page: 1,
    pageSize: 50,
  })

  assert.equal(url, '/admin/audit-logs?q=asset-01')
})
