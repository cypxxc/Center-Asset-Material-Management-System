import test from 'node:test'
import assert from 'node:assert/strict'
import { healIssues } from '@/lib/self-healing/healer'
import { DiagnosticIssue } from '@/lib/self-healing/types'

test('healer skips unhealable issues with status SKIPPED', async () => {
  const issues: DiagnosticIssue[] = [
    {
      code: 'DUPLICATE_IDENTIFIER',
      title: 'Duplicate serial number',
      severity: 'HIGH',
      autoHealable: false,
      details: { field: 'serial_no', value: 'SER-01' },
    },
  ]

  const results = await healIssues(issues, {
    revalidateCache: async () => {},
    quarantineOrphanItems: async () => 0,
    recordAudit: async () => 'audit-123',
  })

  assert.equal(results.length, 1)
  assert.equal(results[0].status, 'SKIPPED')
  assert.equal(results[0].issueCode, 'DUPLICATE_IDENTIFIER')
})

test('healer executes revalidate_cache for STALE_CACHE and records audit', async () => {
  let cacheRevalidated = false
  const auditLogs: Array<{ action: string; details: Record<string, unknown> }> = []

  const issues: DiagnosticIssue[] = [
    {
      code: 'STALE_CACHE',
      title: 'Stale cache',
      severity: 'LOW',
      autoHealable: true,
      details: { cachedCount: 10, liveCount: 12 },
    },
  ]

  const results = await healIssues(issues, {
    revalidateCache: async () => {
      cacheRevalidated = true
    },
    quarantineOrphanItems: async () => 0,
    recordAudit: async (entry) => {
      auditLogs.push(entry)
      return 'audit-stale-001'
    },
  })

  assert.equal(results.length, 1)
  assert.equal(results[0].status, 'SUCCESS')
  assert.equal(results[0].issueCode, 'STALE_CACHE')
  assert.equal(cacheRevalidated, true)
  assert.equal(auditLogs.length, 1)
  assert.equal(auditLogs[0].action, 'SYSTEM_SELF_HEAL')
})

test('healer quarantines orphaned items and records audit with affected count', async () => {
  let quarantinedCount = 0
  const auditLogs: Array<{ action: string; details: Record<string, unknown> }> = []

  const issues: DiagnosticIssue[] = [
    {
      code: 'ORPHAN_RELATION',
      title: 'Orphan items',
      severity: 'MEDIUM',
      autoHealable: true,
      details: {
        count: 2,
        items: [
          { id: 'item-1', name: 'Desk', missingCategory: 'cat-x' },
          { id: 'item-2', name: 'Chair', missingLocation: 'loc-y' },
        ],
      },
    },
  ]

  const results = await healIssues(issues, {
    revalidateCache: async () => {},
    quarantineOrphanItems: async (orphanItems) => {
      quarantinedCount = orphanItems.length
      return quarantinedCount
    },
    recordAudit: async (entry) => {
      auditLogs.push(entry)
      return 'audit-orphan-002'
    },
  })

  assert.equal(results.length, 1)
  assert.equal(results[0].status, 'SUCCESS')
  assert.equal(results[0].issueCode, 'ORPHAN_RELATION')
  assert.equal(quarantinedCount, 2)
  assert.equal(auditLogs.length, 1)
  assert.equal(auditLogs[0].action, 'SYSTEM_SELF_HEAL')
  assert.equal((auditLogs[0].details as any).quarantinedCount, 2)
})
