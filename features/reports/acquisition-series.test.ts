import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAcquisitionSeries, type AcquisitionSummary } from './acquisition-series'

test('fiscal September/October and calendar December/January boundaries assign each month once', () => {
  const summary: AcquisitionSummary = {
    asOf: '2026-11-12', missingDateCount: 0, futureDateCount: 0,
    months: [[2025, 9, 1], [2025, 10, 2], [2025, 12, 4], [2026, 1, 8]].map(([year, month, recordCount]) => (
      { year, month, recordCount, knownValue: recordCount * 100, missingPriceCount: 0 }
    )),
  }
  const fiscal = buildAcquisitionSeries(summary, 'fiscal', 2026)
  const calendar = buildAcquisitionSeries(summary, 'calendar', 2025)
  assert.equal(fiscal.totals.recordCount, 14)
  assert.equal(calendar.totals.recordCount, 7)
  assert.deepEqual(fiscal.periods.slice(0, 4).map(p => p.key), ['2025-10', '2025-11', '2025-12', '2026-1'])
  assert.equal(fiscal.periods.at(-1)?.key, '2026-9')
  assert.equal(calendar.periods[0].key, '2025-1')
  assert.equal(calendar.periods.at(-1)?.key, '2025-12')
  assert.equal(buildAcquisitionSeries(summary, 'calendar', null).totals.recordCount, 15)
  assert.equal(buildAcquisitionSeries(summary, 'fiscal', null).totals.recordCount, 15)
})
