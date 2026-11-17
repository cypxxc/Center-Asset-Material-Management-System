import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateAcquisitionChange, forecastAcquisitions, getPeriodChange } from '../../features/reports/acquisition-trend'
import type { AcquisitionPeriod, AcquisitionSummary } from '../../features/reports/acquisition-series'

const data: AcquisitionSummary = {
  asOf: '2026-11-12', missingDateCount: 0, futureDateCount: 0,
  months: [
    { year: 2023, month: 1, recordCount: 100, knownValue: 1000, missingPriceCount: 0 },
    { year: 2024, month: 1, recordCount: 120, knownValue: 1200, missingPriceCount: 0 },
    { year: 2025, month: 1, recordCount: 140, knownValue: 1400, missingPriceCount: 0 },
    { year: 2026, month: 1, recordCount: 2, knownValue: 20, missingPriceCount: 0 },
  ],
}
const period: AcquisitionPeriod = { key: '2025', label: '2568', fullLabel: 'ปีปฏิทิน 2568', recordCount: 100, knownValue: 1000, missingPriceCount: 0, future: false }

test('percentage arrows distinguish rise, fall, flat and a zero baseline', () => {
  assert.deepEqual(calculateAcquisitionChange(100, 125), { direction: 'up', percent: 25, label: '↑ 25%' })
  assert.deepEqual(calculateAcquisitionChange(100, 75), { direction: 'down', percent: -25, label: '↓ 25%' })
  assert.deepEqual(calculateAcquisitionChange(100, 100), { direction: 'flat', percent: 0, label: '→ 0%' })
  assert.equal(calculateAcquisitionChange(0, 10).label, '↑ จาก 0')
  assert.equal(calculateAcquisitionChange(0, 10).percent, null)
  assert.equal(calculateAcquisitionChange(0, 0).label, '→ 0%')
})

test('no percentage compares an incomplete period, missing price, or a future period', () => {
  assert.equal(getPeriodChange(period, { ...period, partial: true }, 'count'), null)
  assert.equal(getPeriodChange({ ...period, partial: true }, period, 'count'), null)
  assert.equal(getPeriodChange(period, { ...period, future: true }, 'count'), null)
  assert.equal(getPeriodChange(period, { ...period, missingPriceCount: 1 }, 'value'), null)
  assert.equal(getPeriodChange({ ...period, missingPriceCount: 1 }, period, 'value'), null)
  assert.equal(getPeriodChange(period, { ...period, recordCount: 125, missingPriceCount: 1 }, 'count')?.percent, 25)
})

test('forecast uses ended years, ignores current partial totals, and predicts next calendar year', () => {
  const result = forecastAcquisitions(data, 'calendar', 'count')
  assert.ok(result.forecast)
  assert.equal(result.forecast.year, 2027)
  assert.equal(result.forecast.value, 180)
  assert.equal(result.forecast.slope, 20)
  assert.equal(result.forecast.baselineYear, 2025)
  assert.equal(result.forecast.yearsUsed, 3)
  assert.equal(forecastAcquisitions(data, 'calendar', 'value').forecast?.value, 1800)
})

test('fiscal forecast uses October boundaries and the next fiscal year', () => {
  const fiscal: AcquisitionSummary = { ...data, months: [
    { year: 2023, month: 10, recordCount: 10, knownValue: 100, missingPriceCount: 0 },
    { year: 2024, month: 10, recordCount: 20, knownValue: 200, missingPriceCount: 0 },
    { year: 2025, month: 10, recordCount: 30, knownValue: 300, missingPriceCount: 0 },
    { year: 2026, month: 10, recordCount: 1, knownValue: 10, missingPriceCount: 0 },
  ] }
  const prediction = forecastAcquisitions(fiscal, 'fiscal', 'count').forecast
  assert.equal(prediction?.year, 2028)
  assert.equal(prediction?.value, 50)
  assert.equal(prediction?.baselineYear, 2026)
})

test('insufficient, stale, unpriced and negative forecasts have explicit safe results', () => {
  assert.equal(forecastAcquisitions({ ...data, months: data.months.slice(1) }, 'calendar', 'count').forecast, null)
  assert.equal(forecastAcquisitions({ ...data, asOf: '2030-01-01' }, 'calendar', 'count').forecast, null)
  assert.equal(forecastAcquisitions({ ...data, months: data.months.map(m => ({ ...m, missingPriceCount: 1 })) }, 'calendar', 'value').forecast, null)
  const declining = { ...data, months: data.months.map((m, i) => ({ ...m, recordCount: [30, 20, 10, 1][i] })) }
  assert.equal(forecastAcquisitions(declining, 'calendar', 'count').forecast?.value, 0)
  assert.equal(forecastAcquisitions(declining, 'calendar', 'count').forecast?.clamped, true)
})
