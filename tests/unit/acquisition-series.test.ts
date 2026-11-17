import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAcquisitionSeries, type AcquisitionSummary } from '../../features/reports/acquisition-series'

const summary: AcquisitionSummary = {
  asOf: '2026-11-12', missingDateCount: 2, futureDateCount: 1,
  months: [
    { year: 2025, month: 10, recordCount: 1, knownValue: 200, missingPriceCount: 0 },
    { year: 2026, month: 9, recordCount: 2, knownValue: 1000, missingPriceCount: 1 },
    { year: 2026, month: 10, recordCount: 3, knownValue: 500, missingPriceCount: 0 },
  ],
}

test('calendar years aggregate records and known value, not units', () => {
  const result = buildAcquisitionSeries(summary, 'calendar', null)
  assert.deepEqual(result.availableYears, [2026, 2025])
  assert.deepEqual(result.periods.map(p => [p.label, p.recordCount, p.knownValue]), [
    ['2568', 1, 200], ['2569', 5, 1500],
  ])
  assert.equal(result.totals.missingPriceCount, 1)
  assert.equal(result.ongoing, true)
})

test('October enters the following fiscal year while September closes the previous one', () => {
  const result = buildAcquisitionSeries(summary, 'fiscal', null)
  assert.deepEqual(result.periods.map(p => [p.label, p.recordCount]), [['2569', 3], ['2570', 3]])
  const fiscal = buildAcquisitionSeries(summary, 'fiscal', 2026)
  assert.equal(fiscal.periods.length, 12)
  assert.equal(fiscal.periods[0].label, 'ต.ค.')
  assert.equal(fiscal.periods[0].recordCount, 1)
  assert.equal(fiscal.periods[11].label, 'ก.ย.')
  assert.equal(fiscal.periods[11].recordCount, 2)
  assert.equal(fiscal.ongoing, false)
  assert.equal(fiscal.rangeLabel, 'ปีงบประมาณ 2569 · 1 ต.ค. 2568 – 30 ก.ย. 2569')
})

test('selected calendar year fills elapsed months and distinguishes future months', () => {
  const result = buildAcquisitionSeries(summary, 'calendar', 2026)
  assert.equal(result.periods.length, 12)
  assert.equal(result.periods[0].label, 'ม.ค.')
  assert.equal(result.periods[0].recordCount, 0)
  assert.equal(result.periods[0].future, false)
  assert.equal(result.periods[10].future, false)
  assert.equal(result.periods[11].future, true)
  assert.equal(result.periods[11].fullLabel, 'ธันวาคม 2569')
  assert.equal(result.totals.recordCount, 5)
  assert.equal(result.totals.missingPriceCount, 1)
})

test('ongoing fiscal year starts in October and marks later months as future', () => {
  const result = buildAcquisitionSeries(summary, 'fiscal', 2027)
  assert.equal(result.periods[0].fullLabel, 'ตุลาคม 2569')
  assert.equal(result.periods[0].recordCount, 3)
  assert.equal(result.periods[1].future, false)
  assert.equal(result.periods[2].future, true)
  assert.equal(result.periods[11].fullLabel, 'กันยายน 2570')
})

test('empty registry and absent selected year do not fabricate acquisitions', () => {
  const empty = buildAcquisitionSeries({ ...summary, months: [] }, 'calendar', null)
  assert.deepEqual(empty.periods, [])
  assert.deepEqual(empty.availableYears, [])
  assert.equal(empty.totals.recordCount, 0)
  assert.equal(buildAcquisitionSeries(summary, 'calendar', 2000).totals.recordCount, 0)
})

test('missing annual buckets are zero-filled between recorded years', () => {
  const result = buildAcquisitionSeries({ ...summary, months: [
    { year: 2023, month: 1, recordCount: 1, knownValue: 0, missingPriceCount: 1 },
    { year: 2025, month: 1, recordCount: 1, knownValue: 0, missingPriceCount: 1 },
  ] }, 'calendar', null)
  assert.deepEqual(result.periods.map(p => [p.label, p.recordCount]), [['2566', 1], ['2567', 0], ['2568', 1]])
  assert.equal(result.totals.missingPriceCount, 2)
})
