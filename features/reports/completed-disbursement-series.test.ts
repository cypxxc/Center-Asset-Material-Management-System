import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCompletedDisbursementSeries, type CompletedDisbursementSummary } from './completed-disbursement-series'

const summary: CompletedDisbursementSummary = {
  asOf: '2026-11-17', unrecordedHandoverCount: 2,
  months: [
    { year: 2025, month: 10, borrowed: 2, issued: 3 },
    { year: 2026, month: 9, borrowed: 1, issued: 0 },
    { year: 2026, month: 10, borrowed: 0, issued: 4 },
  ],
}

test('monthly fiscal series puts October in the next year and counts documents once', () => {
  const result = buildCompletedDisbursementSeries(summary, 'fiscal', 2026)
  assert.equal(result.periods.length, 12)
  assert.equal(result.periods[0].key, '2025-10')
  assert.equal(result.periods[11].key, '2026-9')
  assert.deepEqual(result.totals, { borrowed: 3, issued: 3, total: 6 })
  assert.equal(result.periods[1].total, 0)
  assert.deepEqual(result.availableYears, [2027, 2026])
})

test('calendar year shows months while all years aggregates one period per year', () => {
  const calendar = buildCompletedDisbursementSeries(summary, 'calendar', 2026)
  assert.deepEqual(calendar.totals, { borrowed: 1, issued: 4, total: 5 })
  assert.equal(calendar.periods[11].future, true)
  const all = buildCompletedDisbursementSeries(summary, 'calendar', null)
  assert.equal(all.periods.length, 2)
  assert.deepEqual(all.totals, { borrowed: 3, issued: 7, total: 10 })
  assert.deepEqual(all.periods.map(period => [period.key, period.borrowed, period.issued]), [
    ['2025', 2, 3], ['2026', 1, 4],
  ])
  const fiscal = buildCompletedDisbursementSeries(summary, 'fiscal', null)
  assert.deepEqual(fiscal.periods.map(period => [period.key, period.borrowed, period.issued]), [
    ['2026', 3, 3], ['2027', 0, 4],
  ])
})

test('empty data is usable, and switching convention preserves an empty selected year', () => {
  assert.deepEqual(buildCompletedDisbursementSeries({ ...summary, months: [] }, 'calendar', null).periods, [])
  const empty = buildCompletedDisbursementSeries(summary, 'calendar', 2027)
  assert.equal(empty.periods.length, 12)
  assert.deepEqual(empty.totals, { borrowed: 0, issued: 0, total: 0 })
  assert.ok(empty.availableYears.includes(2027))
})
