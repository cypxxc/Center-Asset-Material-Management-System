import test from 'node:test'
import assert from 'node:assert/strict'
import { handleGetSelfHealing, handlePostSelfHealing } from '@/lib/self-healing/api-handler'

test('handleGetSelfHealing returns 401 when unauthenticated', async () => {
  const res = await handleGetSelfHealing({
    getProfile: async () => null,
    runDiag: async () => ({ timestamp: '', healthScore: 100, totalIssues: 0, issues: [] }),
  })

  assert.equal(res.status, 401)
  const body = await res.json()
  assert.equal(body.error, 'Unauthorized')
})

test('handleGetSelfHealing returns 403 when user is not admin', async () => {
  const res = await handleGetSelfHealing({
    getProfile: async () => ({ id: 'u1', role: 'viewer', is_active: true }),
    runDiag: async () => ({ timestamp: '', healthScore: 100, totalIssues: 0, issues: [] }),
  })

  assert.equal(res.status, 403)
  const body = await res.json()
  assert.equal(body.error, 'Forbidden: Admin role required')
})

test('handleGetSelfHealing returns diagnostics for admin user', async () => {
  const res = await handleGetSelfHealing({
    getProfile: async () => ({ id: 'admin1', role: 'admin', is_active: true }),
    runDiag: async () => ({
      timestamp: '2026-10-05T00:00:00.000Z',
      healthScore: 95,
      totalIssues: 1,
      issues: [
        { code: 'STALE_CACHE', title: 'Stale cache', severity: 'LOW', autoHealable: true, details: {} },
      ],
    }),
  })

  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.healthScore, 95)
  assert.equal(body.totalIssues, 1)
})

test('handlePostSelfHealing heals issues and returns results for admin', async () => {
  const res = await handlePostSelfHealing({
    getProfile: async () => ({ id: 'admin1', role: 'admin', is_active: true }),
    runDiag: async () => ({
      timestamp: '2026-10-05T00:00:00.000Z',
      healthScore: 95,
      totalIssues: 1,
      issues: [
        { code: 'STALE_CACHE', title: 'Stale cache', severity: 'LOW', autoHealable: true, details: {} },
      ],
    }),
    runHeal: async () => [
      { issueCode: 'STALE_CACHE', status: 'SUCCESS', actionTaken: 'Revalidated cache', auditId: 'audit-1' },
    ],
  })

  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.healedCount, 1)
  assert.equal(body.results.length, 1)
  assert.equal(body.results[0].status, 'SUCCESS')
})
