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

test('MemoryMetricsExporter bounds memory usage via ring buffer and tracks aggregates', () => {
  resetMetricsExporter()
  for (let i = 0; i < 600; i++) {
    metrics.counter('stress.counter', 1)
  }
  const exporter = metrics._getMemoryExporter()
  const snapshots = exporter.getSnapshots()
  assert.ok(snapshots.length <= 500, `Expected <= 500 snapshots in ring buffer, got ${snapshots.length}`)
  const agg = exporter.getAggregates()
  assert.equal(agg['counter:stress.counter']?.count, 600)
  assert.equal(agg['counter:stress.counter']?.sum, 600)
})

