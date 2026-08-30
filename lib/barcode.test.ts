import test from 'node:test'
import assert from 'node:assert/strict'
import { generateCode128Bars } from './barcode'

test('generateCode128Bars handles empty text gracefully', () => {
  const result = generateCode128Bars('')
  // StartB (11) + Checksum (11) + Stop (13) = 35
  assert.equal(result.totalWidth, 35)
  // StartB (3 bars) + Checksum (3 bars) + Stop (4 bars) = 10 bars
  assert.equal(result.bars.length, 10)
})

test('generateCode128Bars produces valid bar structures for asset numbers', () => {
  const assetNo = 'AST-2026-001'
  const result = generateCode128Bars(assetNo)

  // 12 chars * 11 + 35 = 167 total module width
  const expectedWidth = assetNo.length * 11 + 35
  assert.equal(result.totalWidth, expectedWidth)

  // Each data char + start + checksum has 3 bars, stop has 4 bars
  const expectedBarsCount = (assetNo.length + 2) * 3 + 4
  assert.equal(result.bars.length, expectedBarsCount)

  // Verify bar positions are monotonically increasing and within totalWidth
  let lastX = -1
  for (const bar of result.bars) {
    assert.ok(bar.x > lastX, `bar.x (${bar.x}) should be strictly greater than lastX (${lastX})`)
    assert.ok(bar.width >= 1 && bar.width <= 4, `bar.width (${bar.width}) should be between 1 and 4`)
    assert.ok(bar.x + bar.width <= result.totalWidth, `bar end should not exceed totalWidth`)
    lastX = bar.x
  }
})

test('generateCode128Bars generates correct bar coordinates for serial numbers', () => {
  const serialNo = 'SN-9876543210-XYZ'
  const result = generateCode128Bars(serialNo)

  const expectedWidth = serialNo.length * 11 + 35
  assert.equal(result.totalWidth, expectedWidth)
  assert.ok(result.bars.length > 0)

  // Check first bar starts at x = 0
  assert.equal(result.bars[0].x, 0)
  // Check StartB first bar width is 2 (from pattern [2, 1, 1, 2, 1, 4])
  assert.equal(result.bars[0].width, 2)
})

test('generateCode128Bars produces deterministic output', () => {
  const code = 'AST-100'
  const res1 = generateCode128Bars(code)
  const res2 = generateCode128Bars(code)
  assert.deepEqual(res1, res2)
})
