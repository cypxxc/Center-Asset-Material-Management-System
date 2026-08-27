import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateStraightLineDepreciation } from './calculation'

test('calculates straight-line depreciation and keeps one-baht residual value', () => {
  const result = calculateStraightLineDepreciation(
    { enabled: true, cost: 10_001, usefulLifeYears: 5, startDate: '2020-01-01' },
    new Date('2030-01-01T00:00:00'),
  )
  assert.deepEqual(result, { annualDepreciation: 2000, accumulatedDepreciation: 10000, netBookValue: 1, residualValue: 1 })
})

test('does not depreciate before the configured start date', () => {
  const result = calculateStraightLineDepreciation(
    { enabled: true, cost: 1_001, usefulLifeYears: 5, startDate: '2030-01-01' },
    new Date('2029-01-01T00:00:00'),
  )
  assert.equal(result?.accumulatedDepreciation, 0)
  assert.equal(result?.netBookValue, 1001)
})
