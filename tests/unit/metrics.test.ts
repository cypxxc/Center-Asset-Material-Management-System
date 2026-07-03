import { test } from 'node:test'
import assert from 'node:assert/strict'
import { metrics, resetMetricsExporter } from '@/lib/metrics'

test('metrics records counters and histograms', () => {
  resetMetricsExporter()
  metrics.counter('test.counter', 1, { feature: 'test' })
  metrics.histogram('test.histogram', 42, { feature: 'test' })

  const agg = metrics._getMemoryExporter().getAggregates()
  assert.ok(agg['counter:test.counter'])
  assert.ok(agg['histogram:test.histogram'])
  assert.equal(agg['histogram:test.histogram'].sum, 42)
})

test('domain metric helpers increment expected names', () => {
  resetMetricsExporter()
  metrics.itemCreated()
  metrics.loginFailure()
  const snapshots = metrics._getMemoryExporter().getSnapshots()
  assert.ok(snapshots.some((s) => s.name === 'items.created'))
  assert.ok(snapshots.some((s) => s.name === 'login.failure'))
})
