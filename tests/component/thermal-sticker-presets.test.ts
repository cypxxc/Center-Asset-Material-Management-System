import test from 'node:test'
import assert from 'node:assert/strict'
import { STICKER_PRESETS } from '../../components/ui/asset-tag-layout'

test('STICKER_PRESETS includes only standard and custom_grid presets', () => {
  const keys = Object.keys(STICKER_PRESETS)
  assert.deepEqual(keys.sort(), ['custom_grid', 'standard'])

  const standard = STICKER_PRESETS['standard']
  assert.ok(standard, 'standard preset should be defined')
  assert.equal(standard.isSheet, true, 'standard preset should be an A4 sheet')
  assert.equal(standard.sheetGrid?.cols, 2)
  assert.equal(standard.sheetGrid?.rows, 5)
  assert.equal(standard.width, '96mm')
  assert.equal(standard.height, '54mm')

  const custom = STICKER_PRESETS['custom_grid']
  assert.ok(custom, 'custom_grid preset should be defined')
  assert.equal(custom.isSheet, true, 'custom_grid should be an A4 sheet')
})

test('standard preset defines readable typography and dimensions', () => {
  const standard = STICKER_PRESETS['standard']
  assert.ok(standard.padding)
  assert.ok(standard.qrSize)
  assert.ok(standard.barcodeHeight)
  assert.ok(standard.titleSize)
  assert.ok(standard.nameSize)
})
