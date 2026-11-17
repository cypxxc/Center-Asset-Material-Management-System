import test from 'node:test'
import assert from 'node:assert/strict'
import { formatNumberWithCommas, stripCommas } from './number-format'

test('formatNumberWithCommas formats integers with commas', () => {
  assert.equal(formatNumberWithCommas('10000'), '10,000')
  assert.equal(formatNumberWithCommas(1000000), '1,000,000')
  assert.equal(formatNumberWithCommas(''), '')
})

test('formatNumberWithCommas formats decimal numbers when allowDecimals is true', () => {
  assert.equal(formatNumberWithCommas('12500.50', true), '12,500.50')
  assert.equal(formatNumberWithCommas('1000.5', true), '1,000.5')
})

test('stripCommas removes all commas from string', () => {
  assert.equal(stripCommas('10,000.50'), '10000.50')
  assert.equal(stripCommas('1,000,000'), '1000000')
})
